/**
 * 玩家建议反馈服务：建议的创建、投票、完成、删除，持久化到 JSON 文件
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsAsync } from 'fs';
import { randomUUID } from 'crypto';
import { Suggestion } from '@mud/shared';
import { resolveServerDataPath } from '../common/data-path';

@Injectable()
export class SuggestionService implements OnModuleInit {
  private suggestions: Suggestion[] = [];
  private readonly filePath = resolveServerDataPath('runtime', 'suggestions.json');

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fsAsync.readFile(this.filePath, 'utf-8');
        this.suggestions = JSON.parse(raw) as Suggestion[];
      } else {
        this.suggestions = [];
        await this.save();
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      this.suggestions = [];
    }
  }

  private async save(): Promise<void> {
    try {
      await fsAsync.mkdir(path.dirname(this.filePath), { recursive: true });
      await fsAsync.writeFile(this.filePath, `${JSON.stringify(this.suggestions, null, 2)}\n`, 'utf-8');
    } catch (error) {
      console.error('Failed to save suggestions:', error);
    }
  }

  /** 获取所有建议 */
  getAll(): Suggestion[] {
    return this.suggestions;
  }

  /** 创建新建议 */
  async create(authorId: string, authorName: string, title: string, description: string): Promise<Suggestion> {
    const suggestion: Suggestion = {
      id: randomUUID(),
      authorId,
      authorName,
      title,
      description,
      status: 'pending',
      upvotes: [],
      downvotes: [],
      createdAt: Date.now(),
    };
    this.suggestions.push(suggestion);
    await this.save();
    return suggestion;
  }

  /** 对建议投票（赞成/反对，重复点击取消） */
  async vote(playerId: string, suggestionId: string, vote: 'up' | 'down'): Promise<Suggestion | null> {
    const suggestion = this.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return null;

    if (vote === 'up') {
      // 如果已经点过赞，则是取消
      if (suggestion.upvotes.includes(playerId)) {
        suggestion.upvotes = suggestion.upvotes.filter((id) => id !== playerId);
      } else {
        suggestion.upvotes.push(playerId);
        // 同时移除反对票
        suggestion.downvotes = suggestion.downvotes.filter((id) => id !== playerId);
      }
    } else {
      // 如果已经点过踩，则是取消
      if (suggestion.downvotes.includes(playerId)) {
        suggestion.downvotes = suggestion.downvotes.filter((id) => id !== playerId);
      } else {
        suggestion.downvotes.push(playerId);
        // 同时移除赞成票
        suggestion.upvotes = suggestion.upvotes.filter((id) => id !== playerId);
      }
    }

    await this.save();
    return suggestion;
  }

  /** 标记建议为已完成 */
  async markCompleted(suggestionId: string): Promise<Suggestion | null> {
    const suggestion = this.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return null;

    suggestion.status = 'completed';
    await this.save();
    return suggestion;
  }

  /** 删除建议 */
  async remove(suggestionId: string): Promise<boolean> {
    const index = this.suggestions.findIndex((s) => s.id === suggestionId);
    if (index === -1) return false;

    this.suggestions.splice(index, 1);
    await this.save();
    return true;
  }
}
