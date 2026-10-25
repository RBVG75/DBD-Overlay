declare module 'virtual:perk-assets' {
  export interface PerkAsset {
    id: string;
    name: string;
    roles: Array<'killer' | 'survivor'>;
    image: string;
    aliases: string[];
  }

  export const PERK_ASSETS: {
    all: PerkAsset[];
    killer: PerkAsset[];
    survivor: PerkAsset[];
    byKiller: Record<string, string[]>;
  };
}
