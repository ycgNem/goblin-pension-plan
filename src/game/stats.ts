import { PLAYER } from '../data/combat';
import { levelForXp } from '../data/skills';
import type { SaveData } from './save';

/** Numbers that come from skill milestones rather than equipment. */
export interface PlayerStats {
  scrappingLevel: number;
  maxHp: number;
  rollCooldown: number;
}

export function playerStats(save: SaveData): PlayerStats {
  const level = levelForXp(save.skillXp.scrapping ?? 0);
  return {
    scrappingLevel: level,
    maxHp: (PLAYER.baseHearts + (level >= PLAYER.bonusHeartLevel ? 1 : 0)) * 2,
    rollCooldown: level >= PLAYER.roll.fastCooldownLevel ? PLAYER.roll.fastCooldown : PLAYER.roll.cooldown,
  };
}
