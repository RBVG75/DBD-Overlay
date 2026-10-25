// Character portraits shipped with the app. The killer catalogue is canonical
// in data/killers.json; survivor records remain here until their data migration.
//
// The files live in `images/` at the project root, which Vite serves as static
// assets (see `publicDir` in vite.config.js), so `/killers/…` resolves both in
// `npm run dev` and in the packaged build.

import KILLERS from '../data/killers.json';

export { KILLERS };

export const SURVIVORS = [
  { id: 'S01', name: 'Dwight Fairfield', file: 'survis/S01_DwightFairfield_Portrait.webp' },
  { id: 'S02', name: 'Meg Thomas', file: 'survis/S02_MegThomas_Portrait.webp' },
  { id: 'S03', name: 'Claudette Morel', file: 'survis/S03_ClaudetteMorel_Portrait.webp' },
  { id: 'S04', name: 'Jake Park', file: 'survis/S04_JakePark_Portrait.webp' },
  { id: 'S05', name: 'Nea Karlsson', file: 'survis/S05_NeaKarlsson_Portrait.webp' },
  { id: 'S06', name: 'Laurie Strode', file: 'survis/S06_LaurieStrode_Portrait.webp' },
  { id: 'S07', name: 'Ace Visconti', file: 'survis/S07_AceVisconti_Portrait.webp' },
  { id: 'S08', name: 'Bill Overbeck', file: 'survis/S08_BillOverbeck_Portrait.webp' },
  { id: 'S09', name: 'Feng Min', file: 'survis/S09_FengMin_Portrait.webp' },
  { id: 'S10', name: 'David King', file: 'survis/S10_DavidKing_Portrait.webp' },
  { id: 'S11', name: 'Quentin Smith', file: 'survis/S11_QuentinSmith_Portrait.webp' },
  { id: 'S12', name: 'David Tapp', file: 'survis/S12_DavidTapp_Portrait.webp' },
  { id: 'S13', name: 'Kate Denson', file: 'survis/S13_KateDenson_Portrait.webp' },
  { id: 'S14', name: 'Adam Francis', file: 'survis/S14_AdamFrancis_Portrait.webp' },
  { id: 'S15', name: 'Jeff Johansen', file: 'survis/S15_JeffJohansen_Portrait.webp' },
  { id: 'S16', name: 'Jane Romero', file: 'survis/S16_JaneRomero_Portrait.webp' },
  { id: 'S17', name: 'Ash Williams', file: 'survis/S17_AshWilliams_Portrait.webp' },
  { id: 'S18', name: 'Nancy Wheeler', file: 'survis/S18_NancyWheeler_Portrait.webp' },
  { id: 'S19', name: 'Steve Harrington', file: 'survis/S19_SteveHarrington_Portrait.webp' },
  { id: 'S20', name: 'Yui Kimura', file: 'survis/S20_YuiKimura_Portrait.webp' },
  { id: 'S21', name: 'Zarina Kassir', file: 'survis/S21_ZarinaKassir_Portrait.webp' },
  { id: 'S22', name: 'Cheryl Mason', file: 'survis/S22_CherylMason_Portrait.webp' },
  { id: 'S23', name: 'Felix Richter', file: 'survis/S23_FelixRichter_Portrait.webp' },
  { id: 'S24', name: 'Elodie Rakoto', file: 'survis/S24_ElodieRakoto_Portrait.webp' },
  { id: 'S25', name: 'Lee Yun-jin', file: 'survis/S25_LeeYun-jin_Portrait.webp' },
  { id: 'S26', name: 'Jill Valentine', file: 'survis/S26_JillValentine_Portrait.webp' },
  { id: 'S27', name: 'Leon Scott Kennedy', file: 'survis/S27_LeonScottKennedy_Portrait.webp' },
  { id: 'S28', name: 'Mikaela Reid', file: 'survis/S28_MikaelaReid_Portrait.webp' },
  { id: 'S29', name: 'Jonah Vasquez', file: 'survis/S29_JonahVasquez_Portrait.webp' },
  { id: 'S30', name: 'Yoichi Asakawa', file: 'survis/S30_YoichiAsakawa_Portrait.webp' },
  { id: 'S31', name: 'Haddie Kaur', file: 'survis/S31_HaddieKaur_Portrait.webp' },
  { id: 'S32', name: 'Ada Wong', file: 'survis/S32_AdaWong_Portrait.webp' },
  { id: 'S33', name: 'Rebecca Chambers', file: 'survis/S33_RebeccaChambers_Portrait.webp' },
  { id: 'S34', name: 'Vittorio Toscano', file: 'survis/S34_VittorioToscano_Portrait.webp' },
  { id: 'S35', name: 'Thalita Lyra', file: 'survis/S35_ThalitaLyra_Portrait.webp' },
  { id: 'S36', name: 'Renato Lyra', file: 'survis/S36_RenatoLyra_Portrait.webp' },
  { id: 'S37', name: 'Gabriel Soma', file: 'survis/S37_GabrielSoma_Portrait.webp' },
  { id: 'S38', name: 'Nicolas Cage', file: 'survis/S38_NicolasCage_Portrait.webp' },
  { id: 'S39', name: 'Ellen Ripley', file: 'survis/S39_EllenRipley_Portrait.webp' },
  { id: 'S40', name: 'Alan Wake', file: 'survis/S40_AlanWake_Portrait.webp' },
  { id: 'S41', name: 'Sable Ward', file: 'survis/S41_SableWard_Portrait.webp' },
  { id: 'S42', name: 'The Troupe', file: 'survis/S42_TheTroupe_Portrait.webp' },
  { id: 'S43', name: 'Lara Croft', file: 'survis/S43_LaraCroft_Portrait.webp' },
  { id: 'S44', name: 'Trevor Belmont', file: 'survis/S44_TrevorBelmont_Portrait.webp' },
  { id: 'S45', name: 'Taurie Cain', file: 'survis/S45_TaurieCain_Portrait.webp' },
  { id: 'S46', name: 'Orela Rose', file: 'survis/S46_OrelaRose_Portrait.webp' },
  { id: 'S47', name: 'Rick Grimes', file: 'survis/S47_RickGrimes_Portrait.webp' },
  { id: 'S48', name: 'Michonne Grimes', file: 'survis/S48_MichonneGrimes_Portrait.webp' },
  { id: 'S49', name: 'Vee Boonyasak', file: 'survis/S49_VeeBoonyasak_Portrait.webp' },
  { id: 'S50', name: 'Dustin Henderson', file: 'survis/S50_DustinHenderson_Portrait.webp' },
  { id: 'S51', name: 'Eleven', file: 'survis/S51_Eleven_Portrait.webp' },
  { id: 'S52', name: 'Kwon Tae-young', file: 'survis/S52_KwonTae-young_Portrait.webp' },
  { id: 'S53', name: 'Shane Wiigwaas', file: 'survis/S53_ShaneWiigwaas_Portrait.webp' },
  { id: 'S54', name: 'Aurora Stardotter', file: 'survis/S54_AuroraStardotter_Portrait.webp' },
];

export const CATALOGS = [
  { id: 'killers', label: 'Killers', entries: KILLERS },
  { id: 'survivors', label: 'Supervivientes', entries: SURVIVORS },
];

export const CATALOG_IDS = CATALOGS.map((c) => c.id);

export function catalogEntries(catalogId) {
  const catalog = CATALOGS.find((c) => c.id === catalogId) || CATALOGS[0];
  return catalog.entries;
}

export function findCharacter(catalogId, id) {
  const entries = catalogEntries(catalogId);
  return entries.find((entry) => entry.id === id) || entries[0] || null;
}

/** Absolute URL for a portrait, or an empty string when there is nothing to show. */
export function portraitUrl(catalogId, id) {
  const entry = findCharacter(catalogId, id);
  return entry ? `/${entry.file}` : '';
}
