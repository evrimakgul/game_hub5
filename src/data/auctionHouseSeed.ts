import type { AuctionHouseEntry, AuctionHouseMetadata } from "../types/auction.ts";

type AuctionHouseSeedEntry = Omit<AuctionHouseEntry, "stockQuantity"> & {
  stockQuantity?: number | null;
};

export const AUCTION_HOUSE_SEED_METADATA: AuctionHouseMetadata = {
  "lastSessionDate": "2025.09.03",
  "lastFinishedSessionNumber": "26",
  "validSessionWindow": "21-22 (Descensus ad inferos)",
  "notes": [
    "All price values are x1000",
    "Too many in stock = 20+ and AH is no longer buying that type of item",
    "If Bid or Buyout value is 0, that means you can not put any bids, or buying out is not available"
  ]
};

export const AUCTION_HOUSE_SEED_ENTRIES: AuctionHouseSeedEntry[] = [
  {
    "id": "auction-entry-6",
    "sourceRow": 6,
    "bid": 0,
    "buyout": 40,
    "itemName": "Occult Item",
    "itemQuantity": "too many in stock",
    "itemQuality": "0. Common",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Mana +1",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Mana"
    ]
  },
  {
    "id": "auction-entry-7",
    "sourceRow": 7,
    "bid": 0,
    "buyout": 50,
    "itemName": "Lesser Soul Coin",
    "itemQuantity": "Out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Regain 2 Mana, 2 HP",
    "typeLabel": "Consumable",
    "remarks": "No longer they sell in a set. This is the price of each one now.",
    "itemLabels": [
      "HP",
      "Mana"
    ]
  },
  {
    "id": "auction-entry-8",
    "sourceRow": 8,
    "bid": 7,
    "buyout": 10,
    "itemName": "Frozen Orb",
    "itemQuantity": "Out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "7 Cold Damage",
    "typeLabel": "Ammunition",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "Range"
    ]
  },
  {
    "id": "auction-entry-9",
    "sourceRow": 9,
    "bid": 15,
    "buyout": 20,
    "itemName": "Blessed Crossbow Bolts",
    "itemQuantity": "48",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "+4d10 damage vs Undead and Demons",
    "typeLabel": "Ammunition",
    "remarks": "Price is for a set of 6 bolts.",
    "itemLabels": [
      "Dmg",
      "Range"
    ]
  },
  {
    "id": "auction-entry-10",
    "sourceRow": 10,
    "bid": 0,
    "buyout": 8,
    "itemName": "M136 AT4 Rocket",
    "itemQuantity": "6",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "16d10 damage on target, 10d10 8 m. AoE (100 m range)",
    "typeLabel": "Ammunition",
    "remarks": "requires a rocket launcher to use. Does not work in portals.",
    "itemLabels": [
      "Range",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-11",
    "sourceRow": 11,
    "bid": 0,
    "buyout": 4,
    "itemName": "Soldier pill",
    "itemQuantity": "Out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "str +1, stam +1,  int -1 for the duration. works in portals",
    "typeLabel": "Consumable",
    "remarks": "(for a set of 6) / Effective for 4 hours, -2 stamina for 24 hours when the effect wears off",
    "itemLabels": [
      "Strength",
      "Stamina"
    ]
  },
  {
    "id": "auction-entry-12",
    "sourceRow": 12,
    "bid": 0,
    "buyout": 5,
    "itemName": "Millitary grade amphetamine",
    "itemQuantity": "Out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "int +1, wits +1 for the duration. works in portals",
    "typeLabel": "Consumable",
    "remarks": "(for a set of 6) / (Effective for 4 hours, -2 dexterity for 24 hours when the effect wears off)",
    "itemLabels": [
      "Intelligence",
      "Wits"
    ]
  },
  {
    "id": "auction-entry-13",
    "sourceRow": 13,
    "bid": 0,
    "buyout": 8,
    "itemName": "Pill of Dark Vision",
    "itemQuantity": "18",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Provides 25 meter dark vision for the duration.",
    "typeLabel": "Consumable",
    "remarks": "(for a set of 6) / Effective for 4 hours, -2 perception for 24 hours when the effect wears off",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-14",
    "sourceRow": 14,
    "bid": 0,
    "buyout": 40,
    "itemName": "Decanter of (nearly) endless water",
    "itemQuantity": "Out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Permenant",
    "bonus": "2 lt metal water container, fills itself once / hour",
    "typeLabel": "Consumable",
    "remarks": "Works in portals",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-15",
    "sourceRow": 15,
    "bid": 0,
    "buyout": 4,
    "itemName": "Crimson Pill",
    "itemQuantity": "3",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Gain cold resistance and vulnerability to fire for 4 hours",
    "typeLabel": "Consumable",
    "remarks": "",
    "itemLabels": [
      "New",
      "Special"
    ]
  },
  {
    "id": "auction-entry-16",
    "sourceRow": 16,
    "bid": 0,
    "buyout": 6,
    "itemName": "Magenta Pill",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Negates necrotic vulnerability on living, gives acid and lightning vulnerability for 4 hours",
    "typeLabel": "Consumable",
    "remarks": "",
    "itemLabels": [
      "New",
      "Special"
    ]
  },
  {
    "id": "auction-entry-17",
    "sourceRow": 17,
    "bid": 600,
    "buyout": 700,
    "itemName": "Occult Item",
    "itemQuantity": "Out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "DR +1",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "DR"
    ]
  },
  {
    "id": "auction-entry-18",
    "sourceRow": 18,
    "bid": 0,
    "buyout": 300,
    "itemName": "Occult Item",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Mana +2",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Mana"
    ]
  },
  {
    "id": "auction-entry-19",
    "sourceRow": 19,
    "bid": 650,
    "buyout": 800,
    "itemName": "Occult Item - Beads",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Mana +1, HP +1",
    "typeLabel": "Occult",
    "remarks": "Also usable as an amulet",
    "itemLabels": [
      "Mana",
      "HP"
    ]
  },
  {
    "id": "auction-entry-20",
    "sourceRow": 20,
    "bid": 500,
    "buyout": 750,
    "itemName": "Occult Item",
    "itemQuantity": "3",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Elemantal Damage",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "T1"
    ]
  },
  {
    "id": "auction-entry-21",
    "sourceRow": 21,
    "bid": 5,
    "buyout": 7,
    "itemName": "1-Handed Weapon",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Damage",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-22",
    "sourceRow": 22,
    "bid": 6,
    "buyout": 8,
    "itemName": "1-Handed Weapon",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Hit",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-23",
    "sourceRow": 23,
    "bid": 9,
    "buyout": 15,
    "itemName": "1-Handed Weapon of Light",
    "itemQuantity": "3",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Provides 10 meters light while in use",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Special"
    ]
  },
  {
    "id": "auction-entry-24",
    "sourceRow": 24,
    "bid": 11,
    "buyout": 22,
    "itemName": "1-Handed Weapon of Melee",
    "itemQuantity": "4",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "1 bonus to melee skill while in use",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-25",
    "sourceRow": 25,
    "bid": 12,
    "buyout": 15,
    "itemName": "1-Handed Weapon of Initiative",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+2d10 bonus to Initiative rolls",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Special"
    ]
  },
  {
    "id": "auction-entry-26",
    "sourceRow": 26,
    "bid": 7,
    "buyout": 12,
    "itemName": "1-Handed Weapon of HP",
    "itemQuantity": "8",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 HP",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "HP"
    ]
  },
  {
    "id": "auction-entry-27",
    "sourceRow": 27,
    "bid": 4,
    "buyout": 7,
    "itemName": "1-Handed Weapon of Mana",
    "itemQuantity": "10",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Mana",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Mana",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-28",
    "sourceRow": 28,
    "bid": 10,
    "buyout": 16,
    "itemName": "1-Handed Weapon of Stealth",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Stealth Skill",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-29",
    "sourceRow": 29,
    "bid": 0,
    "buyout": 11,
    "itemName": "2-Handed Weapon of Damage",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Damage",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-30",
    "sourceRow": 30,
    "bid": 0,
    "buyout": 12,
    "itemName": "2-Handed Weapon of Hit",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Hit",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-31",
    "sourceRow": 31,
    "bid": 16,
    "buyout": 26,
    "itemName": "2-Handed Weapon of Athletics",
    "itemQuantity": "1",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Athletics Skill",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-32",
    "sourceRow": 32,
    "bid": 14,
    "buyout": 25,
    "itemName": "2-Handed Weapon of Melee Skill",
    "itemQuantity": "4",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Melee Skill",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Skill",
      "Hit"
    ]
  },
  {
    "id": "auction-entry-33",
    "sourceRow": 33,
    "bid": 14,
    "buyout": 20,
    "itemName": "2-Handed Weapon of HP",
    "itemQuantity": "6",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+2 HP",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "HP",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-34",
    "sourceRow": 34,
    "bid": 17,
    "buyout": 28,
    "itemName": "2-Handed Weapon of Intimidation",
    "itemQuantity": "1",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "+1 Intimidation Skill",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-35",
    "sourceRow": 35,
    "bid": 180,
    "buyout": 220,
    "itemName": "Hacked Sword",
    "itemQuantity": "1",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Damage type = cold",
    "typeLabel": "2-Handed Weapon",
    "remarks": "Hit = Dex+Melee, Dmg = Hit Bonus + 1 (cold) (soakable with stamina)",
    "itemLabels": [
      "Dmg",
      "Special"
    ]
  },
  {
    "id": "auction-entry-36",
    "sourceRow": 36,
    "bid": 80,
    "buyout": 110,
    "itemName": "Rifle",
    "itemQuantity": "6",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "8d10 Damage",
    "typeLabel": "Rifle",
    "remarks": "Works in portals, has unlimitted ammo",
    "itemLabels": [
      "Dmg",
      "Range"
    ]
  },
  {
    "id": "auction-entry-37",
    "sourceRow": 37,
    "bid": 25,
    "buyout": 35,
    "itemName": "Crossbow",
    "itemQuantity": "5",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "5d10 Damage, +1 Range Skill",
    "typeLabel": "Crossbow",
    "remarks": "Works in portals, has unlimitted ammo",
    "itemLabels": [
      "Dmg",
      "Range",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-38",
    "sourceRow": 38,
    "bid": 200,
    "buyout": 250,
    "itemName": "Hacked Bow",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "It has fixed damage = ranged skill (soakable with stamina)",
    "typeLabel": "Bow",
    "remarks": "Works in portals, has unlimitted ammo",
    "itemLabels": [
      "Dmg",
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-39",
    "sourceRow": 39,
    "bid": 120,
    "buyout": 150,
    "itemName": "Shotgun",
    "itemQuantity": "3",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "10d10 in melee range, 6d10 in 3-25 meters",
    "typeLabel": "Rifle",
    "remarks": "Works in portals, has unlimitted ammo",
    "itemLabels": [
      "Dmg",
      "Range"
    ]
  },
  {
    "id": "auction-entry-40",
    "sourceRow": 40,
    "bid": 400,
    "buyout": 700,
    "itemName": "Rocket Launcher",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "req: 4 Str, always last to attack, loading takes 1 full turn, damage depends on ammo",
    "typeLabel": "Gun",
    "remarks": "Does not work in portals",
    "itemLabels": [
      "Dmg",
      "Range"
    ]
  },
  {
    "id": "auction-entry-41",
    "sourceRow": 41,
    "bid": 200,
    "buyout": 400,
    "itemName": "Mountable chaingun",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "req: 6 str to use, or montable to a vechile (15d10 damage)",
    "typeLabel": "Gun",
    "remarks": "Does not work in portals,ammo is not unlimited but shitloads. (100 meter range)",
    "itemLabels": [
      "Range",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-42",
    "sourceRow": 42,
    "bid": 30,
    "buyout": 40,
    "itemName": "Shield of Melee Skill",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, Melee Skill +1",
    "typeLabel": "Shield",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-43",
    "sourceRow": 43,
    "bid": 35,
    "buyout": 42,
    "itemName": "Shield of Light",
    "itemQuantity": "1",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, 15 Meter Light",
    "typeLabel": "Shield",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Special"
    ]
  },
  {
    "id": "auction-entry-44",
    "sourceRow": 44,
    "bid": 30,
    "buyout": 45,
    "itemName": "shield of health",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, HP+1",
    "typeLabel": "Shield",
    "remarks": "",
    "itemLabels": [
      "DR",
      "HP"
    ]
  },
  {
    "id": "auction-entry-45",
    "sourceRow": 45,
    "bid": 35,
    "buyout": 50,
    "itemName": "Shield of Intimidation",
    "itemQuantity": "1",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, Intimidation Skill +1",
    "typeLabel": "Shield",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-46",
    "sourceRow": 46,
    "bid": 0,
    "buyout": 250,
    "itemName": "Chromaic Shield",
    "itemQuantity": "1",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "No DR bonus, reduces elemental damage taken by 2",
    "typeLabel": "Shield",
    "remarks": "Elemental damage: (fire, cold, acid, lightning)",
    "itemLabels": [
      "Soak",
      "Special"
    ]
  },
  {
    "id": "auction-entry-47",
    "sourceRow": 47,
    "bid": 220,
    "buyout": 350,
    "itemName": "Hacked Masterwork Energy Shield",
    "itemQuantity": "1",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "AC +1",
    "typeLabel": "Shield",
    "remarks": "",
    "itemLabels": [
      "AC"
    ]
  },
  {
    "id": "auction-entry-48",
    "sourceRow": 48,
    "bid": 22,
    "buyout": 30,
    "itemName": "Crocodile Skin Armor",
    "itemQuantity": "6",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +2, HP +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "HP",
      "DR"
    ]
  },
  {
    "id": "auction-entry-49",
    "sourceRow": 49,
    "bid": 45,
    "buyout": 70,
    "itemName": "Minsk Coat",
    "itemQuantity": "out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, Appereance +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Appereance"
    ]
  },
  {
    "id": "auction-entry-50",
    "sourceRow": 50,
    "bid": 32,
    "buyout": 40,
    "itemName": "Bear Hide",
    "itemQuantity": "out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, HP +2",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "HP",
      "DR"
    ]
  },
  {
    "id": "auction-entry-51",
    "sourceRow": 51,
    "bid": 0,
    "buyout": 20,
    "itemName": "Masterwork Kevlar",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +3",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR"
    ]
  },
  {
    "id": "auction-entry-52",
    "sourceRow": 52,
    "bid": 35,
    "buyout": 40,
    "itemName": "Priest Robe",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "Int +1, Mana +2",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "Mana",
      "Intelligence"
    ]
  },
  {
    "id": "auction-entry-53",
    "sourceRow": 53,
    "bid": 45,
    "buyout": 60,
    "itemName": "Fox Coat",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR: +1, Wits +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Wits"
    ]
  },
  {
    "id": "auction-entry-54",
    "sourceRow": 54,
    "bid": 40,
    "buyout": 50,
    "itemName": "G.I Joe Cammo",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "Stealth +1, Athletics +1, HP +2",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "HP",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-55",
    "sourceRow": 55,
    "bid": 40,
    "buyout": 50,
    "itemName": "Monk Robe",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "HP +4",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "HP"
    ]
  },
  {
    "id": "auction-entry-56",
    "sourceRow": 56,
    "bid": 0,
    "buyout": 9,
    "itemName": "Ring of Health",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "HP +1",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "HP"
    ]
  },
  {
    "id": "auction-entry-57",
    "sourceRow": 57,
    "bid": 0,
    "buyout": 9,
    "itemName": "Ring of Mana",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Mana +1",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Mana"
    ]
  },
  {
    "id": "auction-entry-58",
    "sourceRow": 58,
    "bid": 30,
    "buyout": 45,
    "itemName": "Ring of Initiatvie",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "+2 to Initiative rolls",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-59",
    "sourceRow": 59,
    "bid": 40,
    "buyout": 45,
    "itemName": "Ring of Melee",
    "itemQuantity": "3",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Melee Damage +1d10",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-60",
    "sourceRow": 60,
    "bid": 90,
    "buyout": 110,
    "itemName": "Carnivorous Ring",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Heals the user 1 HP / creature you kill",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-61",
    "sourceRow": 61,
    "bid": 0,
    "buyout": 12,
    "itemName": "Amulet of HP",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "HP +1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "HP"
    ]
  },
  {
    "id": "auction-entry-62",
    "sourceRow": 62,
    "bid": 0,
    "buyout": 8,
    "itemName": "Amulet of Mana",
    "itemQuantity": "too many in stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Mana +1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Mana"
    ]
  },
  {
    "id": "auction-entry-63",
    "sourceRow": 63,
    "bid": 10,
    "buyout": 12,
    "itemName": "Amulet of Night Vision",
    "itemQuantity": "Out of stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Gives 25 meters night vision",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-64",
    "sourceRow": 64,
    "bid": 180,
    "buyout": 200,
    "itemName": "Amulet of Athletics",
    "itemQuantity": "out of stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Athletics Skill +1",
    "typeLabel": "Amulet",
    "remarks": "Overpriced due to its use in sports events",
    "itemLabels": [
      "Skill"
    ]
  },
  {
    "id": "auction-entry-65",
    "sourceRow": 65,
    "bid": 30,
    "buyout": 40,
    "itemName": "Amulet of Healing",
    "itemQuantity": "2",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "healing amount +1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-66",
    "sourceRow": 66,
    "bid": 200,
    "buyout": 300,
    "itemName": "Blind Amulet of Wits",
    "itemQuantity": "Out of Stock",
    "itemQuality": "1. Uncommon",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Wits +2, Per -2",
    "typeLabel": "Amulet",
    "remarks": "You become deaf and blind if your Per becomes 0",
    "itemLabels": [
      "Wits"
    ]
  },
  {
    "id": "auction-entry-67",
    "sourceRow": 67,
    "bid": 40,
    "buyout": 50,
    "itemName": "Lightning Arrows",
    "itemQuantity": "20",
    "itemQuality": "2. Rare",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Provides +3d10 damage to the target with no lightning resistance",
    "typeLabel": "Ammunition",
    "remarks": "Set of 5 price",
    "itemLabels": [
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-68",
    "sourceRow": 68,
    "bid": 50,
    "buyout": 60,
    "itemName": "Radint Arrows",
    "itemQuantity": "40",
    "itemQuality": "2. Rare",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Provides +3d10 damage to the target with no radiant resistance",
    "typeLabel": "Ammunition",
    "remarks": "set of 5 price",
    "itemLabels": [
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-69",
    "sourceRow": 69,
    "bid": 0,
    "buyout": 120,
    "itemName": "Regular Soul Coin",
    "itemQuantity": "Out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Restores +3 mana, +3 health",
    "typeLabel": "Consumable",
    "remarks": "(price is for each coin)",
    "itemLabels": [
      "Mana",
      "HP"
    ]
  },
  {
    "id": "auction-entry-70",
    "sourceRow": 70,
    "bid": 12,
    "buyout": 15,
    "itemName": "Acid Orb",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "8 acid damge on a single target",
    "typeLabel": "Consumable",
    "remarks": "Hit = Dex + Athletics vs Defense",
    "itemLabels": [
      "Dmg",
      "Special"
    ]
  },
  {
    "id": "auction-entry-71",
    "sourceRow": 71,
    "bid": 12,
    "buyout": 15,
    "itemName": "Lava Orb",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "8 fire damage on a single target",
    "typeLabel": "Consumable",
    "remarks": "Hit = Dex + Athletics vs Defense",
    "itemLabels": [
      "Dmg",
      "Special"
    ]
  },
  {
    "id": "auction-entry-72",
    "sourceRow": 72,
    "bid": 20,
    "buyout": 50,
    "itemName": "Vial of Water from Ganga River",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Effect of this water is random. You either get sick and take -6 HP, or you will get fully healed",
    "typeLabel": "Consumable",
    "remarks": "Filled with holy bacteria",
    "itemLabels": [
      "HP",
      "Special"
    ]
  },
  {
    "id": "auction-entry-73",
    "sourceRow": 73,
    "bid": 0,
    "buyout": 20,
    "itemName": "Supernaturally concentrated bull pheromone",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "While seducing females, roll App+Social with 2d10 bonus and advantage (lasts 1 hour)",
    "typeLabel": "Consumable",
    "remarks": "You do not grow horns, but someone else may",
    "itemLabels": [
      "New",
      "Appereance",
      "Skill",
      "Special"
    ]
  },
  {
    "id": "auction-entry-74",
    "sourceRow": 74,
    "bid": 0,
    "buyout": 20,
    "itemName": "Supernaturally concentrated spider pheromone",
    "itemQuantity": "Out of Stock",
    "itemQuality": "2. Rare",
    "bodyPart": "",
    "spec": "Single Use",
    "bonus": "While seducing males, roll App+Social with 2d10 bonus and advantage (lasts 1 hour)",
    "typeLabel": "Consumable",
    "remarks": "You might feel a little urge to eat your partner after sex",
    "itemLabels": [
      "New",
      "Appereance",
      "Skill",
      "Special"
    ]
  },
  {
    "id": "auction-entry-75",
    "sourceRow": 75,
    "bid": 0,
    "buyout": 2500,
    "itemName": "Occult Item, Darkfire",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Shadow damage +1, Fire damage +1, Can convert shadow damage to fire, fire damage to shadow",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-76",
    "sourceRow": 76,
    "bid": 1200,
    "buyout": 2500,
    "itemName": "1Handed Occult item, pocket watch",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Mana +2, can be used with a shield, while holding a shield, allows casting spells",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Mana"
    ]
  },
  {
    "id": "auction-entry-77",
    "sourceRow": 77,
    "bid": 1500,
    "buyout": 1800,
    "itemName": "Occult item, purple colored banner",
    "itemQuantity": "3",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Mana +5",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Mana"
    ]
  },
  {
    "id": "auction-entry-78",
    "sourceRow": 78,
    "bid": 1000,
    "buyout": 0,
    "itemName": "Occult item, preserved dolphin brain",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Int +1, Wits +1",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Intelligence",
      "Wits"
    ]
  },
  {
    "id": "auction-entry-79",
    "sourceRow": 79,
    "bid": 1600,
    "buyout": 2000,
    "itemName": "Occult item, jar of fireflies",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "provides light 6 meter range, +2 to fire damage",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "Special"
    ]
  },
  {
    "id": "auction-entry-80",
    "sourceRow": 80,
    "bid": 1500,
    "buyout": 2000,
    "itemName": "Occult item, stethoscope in a sealed jar",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Int +1, Healing amount bonus +2",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Intelligence",
      "Special"
    ]
  },
  {
    "id": "auction-entry-81",
    "sourceRow": 81,
    "bid": 85,
    "buyout": 120,
    "itemName": "Razor",
    "itemQuantity": "0",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +1, Dmg +1",
    "typeLabel": "1-Handed Weapon",
    "remarks": "Small weapon, can be carried in ass pocket",
    "itemLabels": [
      "Hit",
      "Dmg",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-82",
    "sourceRow": 82,
    "bid": 0,
    "buyout": 60,
    "itemName": "1-handed Weapon",
    "itemQuantity": "too many in stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Dmg +2",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-83",
    "sourceRow": 83,
    "bid": 0,
    "buyout": 60,
    "itemName": "1-handed Weapon",
    "itemQuantity": "too many in stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +2",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-84",
    "sourceRow": 84,
    "bid": 100,
    "buyout": 120,
    "itemName": "1-handed Weapon",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "HP +3",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "HP",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-85",
    "sourceRow": 85,
    "bid": 130,
    "buyout": 180,
    "itemName": "1-handed Weapon",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "DR +1",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-86",
    "sourceRow": 86,
    "bid": 170,
    "buyout": 200,
    "itemName": "Blessed Sword",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Dmg +4d10 against undead and demons",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "Melee",
      "Special"
    ]
  },
  {
    "id": "auction-entry-87",
    "sourceRow": 87,
    "bid": 160,
    "buyout": 200,
    "itemName": "Defending Sword",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "AC +1",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "AC",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-88",
    "sourceRow": 88,
    "bid": 200,
    "buyout": 250,
    "itemName": "bashing club",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Str +1",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Strength",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-89",
    "sourceRow": 89,
    "bid": 400,
    "buyout": 550,
    "itemName": "paratonel spear",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Elementalist damage done to your party will be directed to you",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Special",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-90",
    "sourceRow": 90,
    "bid": 1400,
    "buyout": 1800,
    "itemName": "Hacked hackett",
    "itemQuantity": "4",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Acid type damage. Hit: (dex+melee)d10, Damage: (4+bonus from hit) (soakable with stamina)",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Special"
    ]
  },
  {
    "id": "auction-entry-91",
    "sourceRow": 91,
    "bid": 0,
    "buyout": 80,
    "itemName": "2-handed Weapon",
    "itemQuantity": "too many in stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +1, Dmg +1",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Dmg",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-92",
    "sourceRow": 92,
    "bid": 130,
    "buyout": 150,
    "itemName": "2-handed Weapon",
    "itemQuantity": "8",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "HP +4",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "HP",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-93",
    "sourceRow": 93,
    "bid": 160,
    "buyout": 180,
    "itemName": "2-handed Weapon",
    "itemQuantity": "4",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Dex +1",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Dexterity"
    ]
  },
  {
    "id": "auction-entry-94",
    "sourceRow": 94,
    "bid": 350,
    "buyout": 400,
    "itemName": "Clown Hammer",
    "itemQuantity": "Out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Wits -2, Stealth -2, Hit +3, Dmg +3",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Dmg",
      "Melee",
      "Wits",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-95",
    "sourceRow": 95,
    "bid": 180,
    "buyout": 220,
    "itemName": "Weapon of Casting",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "You can use all supernatural skills while equiped with this weapon",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Special"
    ]
  },
  {
    "id": "auction-entry-96",
    "sourceRow": 96,
    "bid": 300,
    "buyout": 350,
    "itemName": "Frostfire",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "1.5 Damage against cold and fire vulnerable creatures",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "Melee",
      "Special"
    ]
  },
  {
    "id": "auction-entry-97",
    "sourceRow": 97,
    "bid": 240,
    "buyout": 280,
    "itemName": "Barrier Axe",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "DR +2",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-98",
    "sourceRow": 98,
    "bid": 300,
    "buyout": 400,
    "itemName": "sanguivorous spear",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "hit +1, heals the user by 1 HP if damage is given to a living target",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Special"
    ]
  },
  {
    "id": "auction-entry-99",
    "sourceRow": 99,
    "bid": 200,
    "buyout": 230,
    "itemName": "bok-ken",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Dex +2 damage -2",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Dexterity",
      "Special"
    ]
  },
  {
    "id": "auction-entry-100",
    "sourceRow": 100,
    "bid": 400,
    "buyout": 500,
    "itemName": "3 Handed Sword",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +1, Dam +1, standard damage is str+9, instead of str+6",
    "typeLabel": "2-Handed Weapon",
    "remarks": "Requires: 4 Str to carry, 8 Str to use",
    "itemLabels": [
      "Hit",
      "Dmg",
      "Special"
    ]
  },
  {
    "id": "auction-entry-101",
    "sourceRow": 101,
    "bid": 650,
    "buyout": 800,
    "itemName": "Hell-forged 2 handed crescent sword",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Dex +1, if your Dex stat > Str, you might use Dex for damaging dice rolls for this sword.",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "New",
      "Melee",
      "Dexterity"
    ]
  },
  {
    "id": "auction-entry-102",
    "sourceRow": 102,
    "bid": 130,
    "buyout": 150,
    "itemName": "Crossbow",
    "itemQuantity": "7",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +2",
    "typeLabel": "Crossbow",
    "remarks": "Unlimitted ammo",
    "itemLabels": [
      "Hit",
      "Range"
    ]
  },
  {
    "id": "auction-entry-103",
    "sourceRow": 103,
    "bid": 1000,
    "buyout": 1200,
    "itemName": "Shotgun",
    "itemQuantity": "3",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "10d10 damage. damage does not reduce when out of melee range.",
    "typeLabel": "Gun",
    "remarks": "works in portals, unlimited ammo",
    "itemLabels": [
      "Range"
    ]
  },
  {
    "id": "auction-entry-104",
    "sourceRow": 104,
    "bid": 600,
    "buyout": 700,
    "itemName": "Stormtrooper rifle",
    "itemQuantity": "5",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "hit -2, int -1, 12d10 damage",
    "typeLabel": "Gun",
    "remarks": "works in portals, unlimited energy. 50 meter range.",
    "itemLabels": [
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-105",
    "sourceRow": 105,
    "bid": 250,
    "buyout": 300,
    "itemName": "Repeating crossbow",
    "itemQuantity": "3",
    "itemQuality": "2. Rare",
    "bodyPart": "Head",
    "spec": "Single Use",
    "bonus": "Can attack an extra time in a standard action.",
    "typeLabel": "Crossbow",
    "remarks": "works in portals, unlimited ammo",
    "itemLabels": [
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-106",
    "sourceRow": 106,
    "bid": 450,
    "buyout": 500,
    "itemName": "Laser Pistol",
    "itemQuantity": "0",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Dmg = 1 + Hit Bonus (fire damage soaked with stamina)",
    "typeLabel": "Gun",
    "remarks": "Unlimitted Energy, works in portals (1 handed)",
    "itemLabels": [
      "Dmg",
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-107",
    "sourceRow": 107,
    "bid": 600,
    "buyout": 700,
    "itemName": "Chaingun",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "12d10 Damage (Req. 4 Str, always last to attack)",
    "typeLabel": "Rifle",
    "remarks": "Unlimitted ammo, works in portals",
    "itemLabels": [
      "Dmg",
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-108",
    "sourceRow": 108,
    "bid": 200,
    "buyout": 250,
    "itemName": "Composite Bow",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "6d10 + (str / 2)d10 Damage",
    "typeLabel": "Bow",
    "remarks": "Unlimited ammo, works in portals",
    "itemLabels": [
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-109",
    "sourceRow": 109,
    "bid": 280,
    "buyout": 360,
    "itemName": "Bear Stuffing Cotton Armor",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, HP +5",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "HP",
      "DR"
    ]
  },
  {
    "id": "auction-entry-110",
    "sourceRow": 110,
    "bid": 350,
    "buyout": 400,
    "itemName": "T-Shirt soaked in demon sweat",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "Stam +1, BR Skill +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "Stamina",
      "T1"
    ]
  },
  {
    "id": "auction-entry-111",
    "sourceRow": 111,
    "bid": 320,
    "buyout": 400,
    "itemName": "Torn Shroud",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "HP +2, Necromancy Skill +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "HP",
      "T1"
    ]
  },
  {
    "id": "auction-entry-112",
    "sourceRow": 112,
    "bid": 250,
    "buyout": 275,
    "itemName": "Snakeskin Armor",
    "itemQuantity": "3",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +3, Dex +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Dexterity"
    ]
  },
  {
    "id": "auction-entry-113",
    "sourceRow": 113,
    "bid": 230,
    "buyout": 250,
    "itemName": "Demonskin Armor",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +3, Mana +2",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "Mana",
      "DR"
    ]
  },
  {
    "id": "auction-entry-114",
    "sourceRow": 114,
    "bid": 260,
    "buyout": 300,
    "itemName": "Shell Armor MK2",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +4, HP +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "HP",
      "DR"
    ]
  },
  {
    "id": "auction-entry-115",
    "sourceRow": 115,
    "bid": 220,
    "buyout": 250,
    "itemName": "Scientist Robe",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, Int +1, Elemental Dmg +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Intelligence",
      "T1"
    ]
  },
  {
    "id": "auction-entry-116",
    "sourceRow": 116,
    "bid": 160,
    "buyout": 180,
    "itemName": "Uncle Wifebeater",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, Strength +2",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Strength"
    ]
  },
  {
    "id": "auction-entry-117",
    "sourceRow": 117,
    "bid": 600,
    "buyout": 800,
    "itemName": "Hooter\u2019s waitress costume",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "AC +2 , Dex +1, App +2 if worn by a female",
    "typeLabel": "Armor",
    "remarks": "-2 App, +2 intimidation if worn by a male (+3 intimidation, if the user is a male nigger)",
    "itemLabels": [
      "AC",
      "Dexterity",
      "Appereance",
      "Skill",
      "Special"
    ]
  },
  {
    "id": "auction-entry-118",
    "sourceRow": 118,
    "bid": 1500,
    "buyout": 0,
    "itemName": "Cyborg Armor",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "Requires 1 minute to be operational after wearing it. \n5 DR, +1 Int, +1 Dex",
    "typeLabel": "Armor",
    "remarks": "You can not use any head / face slot items while wearing this. Works in portals",
    "itemLabels": [
      "DR",
      "Intelligence",
      "Dexterity",
      "Special"
    ]
  },
  {
    "id": "auction-entry-119",
    "sourceRow": 119,
    "bid": 300,
    "buyout": 400,
    "itemName": "Barbarian Armor",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +2, +1 Str, +1 to melee skill",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Strength",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-120",
    "sourceRow": 120,
    "bid": 200,
    "buyout": 300,
    "itemName": "Partizanski Parka",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, +1 Cha, +1 Man",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Charisma",
      "Manipulation"
    ]
  },
  {
    "id": "auction-entry-121",
    "sourceRow": 121,
    "bid": 0,
    "buyout": 400,
    "itemName": "Pikachu Costume",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "Gives lightning immunity, +2 to lightning damage",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-122",
    "sourceRow": 122,
    "bid": 1500,
    "buyout": 5000,
    "itemName": "Cloak of Hermaphroditus",
    "itemQuantity": "Out of Stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Upper Body",
    "spec": "",
    "bonus": "Changes the sex of the wearer (its a trap) for unknown duration",
    "typeLabel": "Armor",
    "remarks": "Effect might be permanent of not",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-123",
    "sourceRow": 123,
    "bid": 150,
    "buyout": 150,
    "itemName": "Ring of Health",
    "itemQuantity": "4",
    "itemQuality": "2. Rare",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "HP +2",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "HP"
    ]
  },
  {
    "id": "auction-entry-124",
    "sourceRow": 124,
    "bid": 150,
    "buyout": 200,
    "itemName": "Ring of balance",
    "itemQuantity": "4",
    "itemQuality": "2. Rare",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "HP +1, Mana +1",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "HP",
      "Mana"
    ]
  },
  {
    "id": "auction-entry-125",
    "sourceRow": 125,
    "bid": 230,
    "buyout": 300,
    "itemName": "Ring of Lion",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Str +1",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Strength"
    ]
  },
  {
    "id": "auction-entry-126",
    "sourceRow": 126,
    "bid": 150,
    "buyout": 180,
    "itemName": "Ring of Charisma",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Cha +1",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Charisma"
    ]
  },
  {
    "id": "auction-entry-127",
    "sourceRow": 127,
    "bid": 200,
    "buyout": 260,
    "itemName": "Fang Ring",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Melee Skill +1",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-128",
    "sourceRow": 128,
    "bid": 230,
    "buyout": 300,
    "itemName": "Summoner's Ring",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Summoned creatures get Hit +1d10, Dmg +1d10",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Dmg",
      "Special"
    ]
  },
  {
    "id": "auction-entry-129",
    "sourceRow": 129,
    "bid": 250,
    "buyout": 280,
    "itemName": "Ring of Dirge",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Mana +5, HP -2. HP penalty lasts 'till long rest, even if the ring is removed",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Mana",
      "HP"
    ]
  },
  {
    "id": "auction-entry-130",
    "sourceRow": 130,
    "bid": 300,
    "buyout": 500,
    "itemName": "Ring of the nerd",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Int +2, Str-1",
    "typeLabel": "Ring",
    "remarks": "Str penalty lasts till long rest, even if you remove the ring",
    "itemLabels": [
      "Intelligence"
    ]
  },
  {
    "id": "auction-entry-131",
    "sourceRow": 131,
    "bid": 220,
    "buyout": 300,
    "itemName": "Amulet of Intelligence",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Int +1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Intelligence"
    ]
  },
  {
    "id": "auction-entry-132",
    "sourceRow": 132,
    "bid": 200,
    "buyout": 230,
    "itemName": "Amulet of Cold Resistance",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Provides cold resistance",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-133",
    "sourceRow": 133,
    "bid": 120,
    "buyout": 200,
    "itemName": "Bitch Choker",
    "itemQuantity": "12",
    "itemQuality": "2. Rare",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "App +1, Stam +1, Cha -1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Appereance",
      "Stamina",
      "Charisma"
    ]
  },
  {
    "id": "auction-entry-134",
    "sourceRow": 134,
    "bid": 350,
    "buyout": 380,
    "itemName": "Monk's Beads",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Dex +1, Stam +1, Int -1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Dexterity",
      "Stamina",
      "Intelligence"
    ]
  },
  {
    "id": "auction-entry-135",
    "sourceRow": 135,
    "bid": 250,
    "buyout": 300,
    "itemName": "Big Ben Figurine",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, Str +1, Dex -1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Strength",
      "Dexterity"
    ]
  },
  {
    "id": "auction-entry-136",
    "sourceRow": 136,
    "bid": 400,
    "buyout": 500,
    "itemName": "Dark Amulet",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Necrotic and shadow damage +2, you can not get any benefit from any kind of healing",
    "typeLabel": "Amulet",
    "remarks": "Healing uneffectiveness lasts till long rest, even if you remove the amulet",
    "itemLabels": [
      "Special",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-137",
    "sourceRow": 137,
    "bid": 300,
    "buyout": 800,
    "itemName": "Amulet of Barksin",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "DR +2, Stam +2, Dex -2 (Dex penalty lasts till long rest)(Re-forged)",
    "typeLabel": "Amulet",
    "remarks": "(Re-forged)",
    "itemLabels": [
      "DR",
      "Stamina"
    ]
  },
  {
    "id": "auction-entry-138",
    "sourceRow": 138,
    "bid": 280,
    "buyout": 320,
    "itemName": "Thinking Cap",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "Int +1",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "",
    "itemLabels": [
      "Intelligence"
    ]
  },
  {
    "id": "auction-entry-139",
    "sourceRow": 139,
    "bid": 220,
    "buyout": 260,
    "itemName": "Flying Googles",
    "itemQuantity": "4",
    "itemQuality": "2. Rare",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "Ranged Skill +1, Ranged Dmg +1",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "",
    "itemLabels": [
      "Range",
      "Skill",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-140",
    "sourceRow": 140,
    "bid": 300,
    "buyout": 330,
    "itemName": "Bearskin of Queen's Guard",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "Stam +1, Cha +1, Dex -1",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "",
    "itemLabels": [
      "Stamina",
      "Charisma",
      "Dexterity"
    ]
  },
  {
    "id": "auction-entry-141",
    "sourceRow": 141,
    "bid": 500,
    "buyout": 1200,
    "itemName": "Snow Mask",
    "itemQuantity": "2",
    "itemQuality": "2. Rare",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "Allows you to make cosmetic changes to your face. Changes are random and depend on your appearence stat they last till you remove the mask",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-142",
    "sourceRow": 142,
    "bid": 250,
    "buyout": 280,
    "itemName": "Spartan Helm",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "DR +1, +1 Str, +1 athletics and melee skills,\n-1 stealth, medicine, mechanics, technology, social, academics skills",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Strength",
      "Skill"
    ]
  },
  {
    "id": "auction-entry-143",
    "sourceRow": 143,
    "bid": 400,
    "buyout": 600,
    "itemName": "Nerve Impulse Assistance",
    "itemQuantity": "out of stock",
    "itemQuality": "2. Rare",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "Int +2, Dex -1",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "Dex penalty lasts till long rest, even if you remove the head piece",
    "itemLabels": [
      "Intelligence"
    ]
  },
  {
    "id": "auction-entry-144",
    "sourceRow": 144,
    "bid": 300,
    "buyout": 650,
    "itemName": "Chamber pot of Sir Graham the ever-constipated",
    "itemQuantity": "1",
    "itemQuality": "2. Rare",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "DR +2, Per -2, Cha -2, App -2, HP +10",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "If any of your stats become 0 while wearing this chamber pot, you can not gain the HP bonus",
    "itemLabels": [
      "DR",
      "HP"
    ]
  },
  {
    "id": "auction-entry-145",
    "sourceRow": 145,
    "bid": 320,
    "buyout": 400,
    "itemName": "Raja Soul Coin",
    "itemQuantity": "Out of Stock",
    "itemQuality": "3. Epic",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "mana + 4, health +4. restore on use)",
    "typeLabel": "Consumable",
    "remarks": "(price is for each coin) (Humming sound and tingling is noticable, while holding this in your hand)",
    "itemLabels": [
      "Mana",
      "HP"
    ]
  },
  {
    "id": "auction-entry-146",
    "sourceRow": 146,
    "bid": 600,
    "buyout": 0,
    "itemName": "Heartstone",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "teleports the user out of a portal, near the portal entrence on earth",
    "typeLabel": "Consumable",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-147",
    "sourceRow": 147,
    "bid": 1600,
    "buyout": 0,
    "itemName": "A piece of uncultuvated 2000 year old ginseng",
    "itemQuantity": "Out of Stock",
    "itemQuality": "3. Epic",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "The eater gains all benefits of a long rest.",
    "typeLabel": "Consumable",
    "remarks": "smuggled from Chinese hunters",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-148",
    "sourceRow": 148,
    "bid": 200,
    "buyout": 400,
    "itemName": "Vial of Agni",
    "itemQuantity": "Out of Stock",
    "itemQuality": "3. Epic",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "You burn your inner fire and take 1 unsoakable damage for 10 turns (1 minute) During this time, all your stats are increased by 2. When the effect wears off, all your stats are decreased by 2 for 10 turns (1 minute). If one of your stats become 0, you incapacitate for 8 hours.",
    "typeLabel": "Consumable",
    "remarks": "ineffective for the people with fire resistance",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-149",
    "sourceRow": 149,
    "bid": 300,
    "buyout": 600,
    "itemName": "Arrow of Parashurama",
    "itemQuantity": "8",
    "itemQuality": "3. Epic",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "When fired from a bow, this arrow splits and gives the damage to all hostile targets in 25 meter radius of the initial target.",
    "typeLabel": "Consumable",
    "remarks": "Parashurama is the warrior avatar of Vishnu",
    "itemLabels": [
      "Range"
    ]
  },
  {
    "id": "auction-entry-150",
    "sourceRow": 150,
    "bid": 70,
    "buyout": 90,
    "itemName": "Frozen Orb",
    "itemQuantity": "4",
    "itemQuality": "3. Epic",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Used with (dex+athletics) Gives 10 cold damage to a single target (soakable with stamina)",
    "typeLabel": "Consumable",
    "remarks": "",
    "itemLabels": [
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-151",
    "sourceRow": 151,
    "bid": 25,
    "buyout": 0,
    "itemName": "Heart Poison",
    "itemQuantity": "Out of Stock",
    "itemQuality": "3. Epic",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "When mixed with a drink, the imbiber rolls (stam+athletics)d10. If success =<6, humanoid target dies",
    "typeLabel": "Consumable",
    "remarks": "colorless, odorless, can only be taken orally and mixed in a drink (loses potency if drink > 1 liter)",
    "itemLabels": [
      "New",
      "Special"
    ]
  },
  {
    "id": "auction-entry-152",
    "sourceRow": 152,
    "bid": 700,
    "buyout": 1500,
    "itemName": "Grinding Stone",
    "itemQuantity": "3 (have bids)",
    "itemQuality": "3. Epic",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "When used on a 1h or 2h unreforged melee weapon, with celestial or lower quality, the weapon gains +1 hit permanently",
    "typeLabel": "Consumable",
    "remarks": "Can only be used once / weapon. The weapon will become reforged.",
    "itemLabels": [
      "New",
      "Hit",
      "Special"
    ]
  },
  {
    "id": "auction-entry-153",
    "sourceRow": 153,
    "bid": 500,
    "buyout": 700,
    "itemName": "Razor",
    "itemQuantity": "4",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +2, Dmg +2",
    "typeLabel": "1-Handed Weapon",
    "remarks": "Small weapon, can be carried in ass pocket",
    "itemLabels": [
      "Hit",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-154",
    "sourceRow": 154,
    "bid": 700,
    "buyout": 900,
    "itemName": "1-handed Weapon",
    "itemQuantity": "2",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Dex +2",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Dexterity"
    ]
  },
  {
    "id": "auction-entry-155",
    "sourceRow": 155,
    "bid": 550,
    "buyout": 750,
    "itemName": "Heated Sword",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +1, Fire Resistance",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Special"
    ]
  },
  {
    "id": "auction-entry-156",
    "sourceRow": 156,
    "bid": 400,
    "buyout": 500,
    "itemName": "1-handed Weapon of Taunting",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "HP +2. Mobs have a higher chance to attack weapon bearer",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "HP",
      "Special"
    ]
  },
  {
    "id": "auction-entry-157",
    "sourceRow": 157,
    "bid": 700,
    "buyout": 750,
    "itemName": "Shiv of True Strike",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +4",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit"
    ]
  },
  {
    "id": "auction-entry-158",
    "sourceRow": 158,
    "bid": 600,
    "buyout": 650,
    "itemName": "Sword of Starlight",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Wielder and his party can see through 50 meters darkness or fog.",
    "typeLabel": "1-Handed Weapon",
    "remarks": "Including supernatural",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-159",
    "sourceRow": 159,
    "bid": 900,
    "buyout": 1200,
    "itemName": "Defender\u2019s axe",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "HP +2, doubles the amount of DR bonus of your shield, while using a shield",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "HP",
      "Special"
    ]
  },
  {
    "id": "auction-entry-160",
    "sourceRow": 160,
    "bid": 800,
    "buyout": 1000,
    "itemName": "Vorpal Axe",
    "itemQuantity": "5",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Its damage ignores target's DR, up to 6.",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Special"
    ]
  },
  {
    "id": "auction-entry-161",
    "sourceRow": 161,
    "bid": 1500,
    "buyout": 0,
    "itemName": "Ming Dynasty sword",
    "itemQuantity": "2",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "this weapon strikes twice, with the same hit success.",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Special"
    ]
  },
  {
    "id": "auction-entry-162",
    "sourceRow": 162,
    "bid": 1200,
    "buyout": 1300,
    "itemName": "2-handed Weapon",
    "itemQuantity": "5",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +2, Dmg +2",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Hit",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-163",
    "sourceRow": 163,
    "bid": 1700,
    "buyout": 1800,
    "itemName": "2-handed Weapon of Reach",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Can attack from 25 meters range and be usable either melee or ranged skill.",
    "typeLabel": "2-Handed Weapon",
    "remarks": "Dmg = 6d10 + Str (even for ranged)",
    "itemLabels": [
      "Melee",
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-164",
    "sourceRow": 164,
    "bid": 1500,
    "buyout": 2500,
    "itemName": "Jealous Berserker",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Str +2, Dex +2, Stam +2. This weapon is cursed.",
    "typeLabel": "2-Handed Weapon",
    "remarks": "After blood-bounding this item, if you wield another weapon or occult item, you lose 1 stamina permanently each time. You do not need to die to get rid of this item's bloodbound, instead, you have to amputate your 4 limbs (arms and legs).",
    "itemLabels": [
      "Strength",
      "Dexterity",
      "Stamina",
      "Special"
    ]
  },
  {
    "id": "auction-entry-165",
    "sourceRow": 165,
    "bid": 2000,
    "buyout": 2250,
    "itemName": "Bard's Sword",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Whole party gets +1 morale bonus to Melee and Ranged Skills.",
    "typeLabel": "2-Handed Weapon",
    "remarks": "Active in 25 meter range up to 8 people",
    "itemLabels": [
      "Melee",
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-166",
    "sourceRow": 166,
    "bid": 1500,
    "buyout": 3000,
    "itemName": "Bone Sword",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Reduce your base HP to give bonus to this sword. For every 2 HP you give to this sword, it gains +1 hit and +1 damage.",
    "typeLabel": "2-Handed Weapon",
    "remarks": "To gain your HP back, you have to break and destroy this weapon. You can increase the HP given, but not reduce it.",
    "itemLabels": [
      "Special",
      "Hit",
      "Dmg",
      "HP",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-167",
    "sourceRow": 167,
    "bid": 1800,
    "buyout": 3000,
    "itemName": "Nine ring dao sword",
    "itemQuantity": "2",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +2, if your Dex is higher than Str, you use Dex, while giving damage",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Melee",
      "Hit",
      "Special"
    ]
  },
  {
    "id": "auction-entry-168",
    "sourceRow": 168,
    "bid": 1400,
    "buyout": 1800,
    "itemName": "Executioner's Axe",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Dmg +1. Once per long rest, dmg = its total dmg dice.",
    "typeLabel": "2-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "Dmg",
      "Special"
    ]
  },
  {
    "id": "auction-entry-169",
    "sourceRow": 169,
    "bid": 4200,
    "buyout": 9000,
    "itemName": "Silent Crossbow",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "(5d10 + user's stealth skill)d10 damage",
    "typeLabel": "Crossbow",
    "remarks": "50 meter range",
    "itemLabels": [
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-170",
    "sourceRow": 170,
    "bid": 0,
    "buyout": 3000,
    "itemName": "Hand Cannon Pistol",
    "itemQuantity": "5",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +2, Unusual pistol damage (8d10)",
    "typeLabel": "Gun",
    "remarks": "25 meter range, unlimited ammo, works in portals",
    "itemLabels": [
      "Range",
      "Hit"
    ]
  },
  {
    "id": "auction-entry-171",
    "sourceRow": 171,
    "bid": 2000,
    "buyout": 2700,
    "itemName": "Gargamel's Smurfberry Blowgun",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "12d10 damage, every attack damages the user 1 HP and makes his lips blue till long rest",
    "typeLabel": "Gun",
    "remarks": "25 meter range, unlimited smurfberry ammo (not eatable, unless you are a smurf)",
    "itemLabels": [
      "Range",
      "Special"
    ]
  },
  {
    "id": "auction-entry-172",
    "sourceRow": 172,
    "bid": 18000,
    "buyout": 0,
    "itemName": "Occult item, carved figure of a small sized (70 cm radius) beholder.",
    "itemQuantity": "Out of Stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Int +2, Stam +2",
    "typeLabel": "Occult",
    "remarks": "When you are not holding this in your hands, you take 2 Dex penalty",
    "itemLabels": [
      "Intelligence",
      "Stamina"
    ]
  },
  {
    "id": "auction-entry-173",
    "sourceRow": 173,
    "bid": 18000,
    "buyout": 0,
    "itemName": "Occult item of Elementalist",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Elementalist skill +2, Int +2",
    "typeLabel": "Occult",
    "remarks": "If you equip this item, you can not use any other supernatural skills other than elementalist, till long rest.",
    "itemLabels": [
      "Intelligence",
      "T1",
      "Special"
    ]
  },
  {
    "id": "auction-entry-174",
    "sourceRow": 174,
    "bid": 16000,
    "buyout": 0,
    "itemName": "Occult item of the Healer",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Healing amount +2, if you use healing on an enemy, it gives radiant damage = your healing amount",
    "typeLabel": "Occult",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-175",
    "sourceRow": 175,
    "bid": 2200,
    "buyout": 2400,
    "itemName": "Einherjar Armor",
    "itemQuantity": "2",
    "itemQuality": "3. Epic",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "HP +1, DR +2, Str +1, Dex +1",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "HP",
      "DR",
      "Strength",
      "Dexterity"
    ]
  },
  {
    "id": "auction-entry-176",
    "sourceRow": 176,
    "bid": 2500,
    "buyout": 3000,
    "itemName": "Reforged Armor of Zaratan",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "DR 7",
    "typeLabel": "Armor",
    "remarks": "(Re-forged)",
    "itemLabels": [
      "DR"
    ]
  },
  {
    "id": "auction-entry-177",
    "sourceRow": 177,
    "bid": 1500,
    "buyout": 2000,
    "itemName": "Robe of Scarlet Monastery",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "2 AC, Your brawl attacks gain +2 hit and +2 damage",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "AC",
      "Hit",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-178",
    "sourceRow": 178,
    "bid": 4500,
    "buyout": 0,
    "itemName": "Many eyed Beholder Skin Armor",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "4 DR, when you identify a creature with Awareness or simmilar skill, you gain 4d10 hit bonus to melee and ranged attacks to that target",
    "typeLabel": "Armor",
    "remarks": "",
    "itemLabels": [
      "DR",
      "Hit",
      "Special"
    ]
  },
  {
    "id": "auction-entry-179",
    "sourceRow": 179,
    "bid": 6000,
    "buyout": 20000,
    "itemName": "Robe of the Manipulator",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "You bribe your mana to increase its DR, hit and damage of your summoned or controlled creatures. For each 3 mana donated, item gains +1 DR to you, +1d10 hit, +1d10 damage to your creatures.",
    "typeLabel": "Armor",
    "remarks": "You need to destroy this item to get your mana back.",
    "itemLabels": [
      "DR",
      "Special"
    ]
  },
  {
    "id": "auction-entry-180",
    "sourceRow": 180,
    "bid": 4500,
    "buyout": 0,
    "itemName": "Enkidu's Armor",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "5 DR, +2 Str, -1 App",
    "typeLabel": "Armor",
    "remarks": "You stink a little",
    "itemLabels": [
      "DR",
      "Strength"
    ]
  },
  {
    "id": "auction-entry-181",
    "sourceRow": 181,
    "bid": 3000,
    "buyout": 12000,
    "itemName": "Condensed Smoke",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "The wearer can change the color of this smoke to red(fire), blue(cold), green(acid), white(lightning), golden(radiant), black(shadow). Changing the color gives resistance to the user, depending on the color.",
    "typeLabel": "Armor",
    "remarks": "Does not gain any stealth benefit. Changing the color costs a bonus action",
    "itemLabels": [
      "New",
      "Special"
    ]
  },
  {
    "id": "auction-entry-182",
    "sourceRow": 182,
    "bid": 6000,
    "buyout": 25000,
    "itemName": "Wearable Iron Maiden",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Upper Body",
    "spec": "When Equipped / Active",
    "bonus": "6 DR, -2 Stam, gives physical resistance (if your Stam becomes 0 or lower, you enter into coma)",
    "typeLabel": "Armor",
    "remarks": "Once worn, can only be removed at long rests",
    "itemLabels": [
      "New",
      "DR",
      "Special"
    ]
  },
  {
    "id": "auction-entry-183",
    "sourceRow": 183,
    "bid": 1800,
    "buyout": 1999,
    "itemName": "Amulet of Health",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "HP +2, Stam +1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "HP",
      "Stamina"
    ]
  },
  {
    "id": "auction-entry-184",
    "sourceRow": 184,
    "bid": 1700,
    "buyout": 1900,
    "itemName": "Amulet of Controller",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Mana +2, Cha +1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Mana",
      "Charisma"
    ]
  },
  {
    "id": "auction-entry-185",
    "sourceRow": 185,
    "bid": 1200,
    "buyout": 1500,
    "itemName": "Amulet of Necrotic Resistance",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "You are no longer vulnerable to necrotic damage.",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-186",
    "sourceRow": 186,
    "bid": 1800,
    "buyout": 2500,
    "itemName": "YinYang Amulet",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Gives shadow and radiant damage resistance",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-187",
    "sourceRow": 187,
    "bid": 1500,
    "buyout": 1700,
    "itemName": "Amulet of Papercut",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Any damage you give, can not be healed till long rest",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-188",
    "sourceRow": 188,
    "bid": 0,
    "buyout": 1800,
    "itemName": "Amulet of the devoted",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Wits +1, Stam +1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "Wits",
      "Stamina"
    ]
  },
  {
    "id": "auction-entry-189",
    "sourceRow": 189,
    "bid": 1500,
    "buyout": 3500,
    "itemName": "Amulet of Danger Sense",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "AC +2, Wits +1",
    "typeLabel": "Amulet",
    "remarks": "",
    "itemLabels": [
      "New",
      "Wits",
      "AC"
    ]
  },
  {
    "id": "auction-entry-190",
    "sourceRow": 190,
    "bid": 0,
    "buyout": 1200,
    "itemName": "Ring of Body Reinforcement",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Decreases mana cost of BR buffs by 1.",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "T1",
      "Special"
    ]
  },
  {
    "id": "auction-entry-191",
    "sourceRow": 191,
    "bid": 1000,
    "buyout": 1200,
    "itemName": "Ring of Health",
    "itemQuantity": "1",
    "itemQuality": "3. Epic",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "HP +4",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "HP"
    ]
  },
  {
    "id": "auction-entry-192",
    "sourceRow": 192,
    "bid": 600,
    "buyout": 750,
    "itemName": "Ring of Preparation",
    "itemQuantity": "0",
    "itemQuality": "3. Epic",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Gain 6d10 bonus to initiative rolls.",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-193",
    "sourceRow": 193,
    "bid": 3000,
    "buyout": 8000,
    "itemName": "Ring of Mirror",
    "itemQuantity": "0",
    "itemQuality": "3. Epic",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Doubles the effect of your other ring",
    "typeLabel": "Ring",
    "remarks": "This item is cursed. If removed, you lose the effect of your other ring for 2 game sessions.",
    "itemLabels": [
      "Special"
    ]
  },
  {
    "id": "auction-entry-194",
    "sourceRow": 194,
    "bid": 1200,
    "buyout": 1500,
    "itemName": "Ring of Splendor",
    "itemQuantity": "Out of Stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Cha +2",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "Charisma"
    ]
  },
  {
    "id": "auction-entry-195",
    "sourceRow": 195,
    "bid": 2200,
    "buyout": 2500,
    "itemName": "King's Crown",
    "itemQuantity": "out of stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "Str +1, Stam +1",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "",
    "itemLabels": [
      "Strength",
      "Stamina"
    ]
  },
  {
    "id": "auction-entry-196",
    "sourceRow": 196,
    "bid": 3500,
    "buyout": 5000,
    "itemName": "Head of the Headless",
    "itemQuantity": "Out of Stock",
    "itemQuality": "3. Epic",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "Wits +2, Stam +2, Int -2",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "",
    "itemLabels": [
      "Wits",
      "Stamina"
    ]
  },
  {
    "id": "auction-entry-197",
    "sourceRow": 197,
    "bid": 1000,
    "buyout": 1500,
    "itemName": "Upper Dantien Protector",
    "itemQuantity": "2",
    "itemQuality": "3. Epic",
    "bodyPart": "Head",
    "spec": "When Equipped / Active",
    "bonus": "Stamina +1, Mana +2",
    "typeLabel": "Hat / Cap / Helmet",
    "remarks": "",
    "itemLabels": [
      "Mana",
      "Stamina"
    ]
  },
  {
    "id": "auction-entry-198",
    "sourceRow": 198,
    "bid": 1200,
    "buyout": 3000,
    "itemName": "Bubbling Cauldron",
    "itemQuantity": "1",
    "itemQuality": "4. Legendary",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "When you use this item in a portal, during a long rest, all your party (up to 10 people) gains +1 bonus to their Str, Stam, Int, Cha and cold resistance till long rest. Each cauldron can be used 3 times, spilling the cauldon gives you a curse of permanent fire vulverability",
    "typeLabel": "Consumable",
    "remarks": "Carrying this item in your inventory gives -2 Dex and vulnerability to fire. If your Dex becomes 0 or lower, you can not move. Each cauldron can be used 3 times.",
    "itemLabels": [
      "New",
      "Strength",
      "Stamina",
      "Charisma",
      "Intelligence",
      "Special"
    ]
  },
  {
    "id": "auction-entry-199",
    "sourceRow": 199,
    "bid": 2200,
    "buyout": 0,
    "itemName": "Elixir of Mana",
    "itemQuantity": "2 (Have bids)",
    "itemQuality": "4. Legendary",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "Gives +1 mana permanently",
    "typeLabel": "Consumable",
    "remarks": "No known side effects",
    "itemLabels": [
      "New",
      "Mana"
    ]
  },
  {
    "id": "auction-entry-200",
    "sourceRow": 200,
    "bid": 240,
    "buyout": 450,
    "itemName": "Runic Rocket",
    "itemQuantity": "8",
    "itemQuality": "4. Legendary",
    "bodyPart": "-",
    "spec": "Single Use",
    "bonus": "When loaded to a rocket launcher, it can be used in portals. 20d10 physical damage to target, 12d10 AoE physical damage in 10 meter radius",
    "typeLabel": "Ammunition",
    "remarks": "Dex+range to use, 100 meter range",
    "itemLabels": [
      "New",
      "Range",
      "Dmg"
    ]
  },
  {
    "id": "auction-entry-201",
    "sourceRow": 201,
    "bid": 8500,
    "buyout": 22000,
    "itemName": "1 handed Mjolnir Replica",
    "itemQuantity": "1",
    "itemQuality": "4. Legendary",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +2, succesful hits made with this weapon creates a lightning strke to the nearest hostile target, other than the main target (max 25 m range), with (Str+melee skill) lightning damage (soakable with stamina)",
    "typeLabel": "1-Handed Weapon",
    "remarks": "",
    "itemLabels": [
      "New",
      "Melee",
      "Hit",
      "Special"
    ]
  },
  {
    "id": "auction-entry-202",
    "sourceRow": 202,
    "bid": 13000,
    "buyout": 28000,
    "itemName": "Totem of Manitou",
    "itemQuantity": "1",
    "itemQuality": "4. Legendary",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "Hit +2, Dam +2, Stam +1, DR +2",
    "typeLabel": "2-Handed Weapon",
    "remarks": "Requires 4 Str to carry, 8 Str to use",
    "itemLabels": [
      "New",
      "Hit",
      "Dmg",
      "Stamina",
      "DR",
      "Melee"
    ]
  },
  {
    "id": "auction-entry-203",
    "sourceRow": 203,
    "bid": 15000,
    "buyout": 35000,
    "itemName": "Gatling Laser",
    "itemQuantity": "1",
    "itemQuality": "4. Legendary",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "16d10 damage, works in portals, unlimited ammo, 50 meter range",
    "typeLabel": "Gun",
    "remarks": "Requires 5 Str, 5 ranged skill to use, mountable on a vechile (this omits Str requirement)",
    "itemLabels": [
      "New",
      "Range"
    ]
  },
  {
    "id": "auction-entry-204",
    "sourceRow": 204,
    "bid": 17000,
    "buyout": 0,
    "itemName": "Shield of the challenger",
    "itemQuantity": "Out of Stock",
    "itemQuality": "4. Legendary",
    "bodyPart": "Hands",
    "spec": "When Equipped / Active",
    "bonus": "DR +2, Stam +2, Cha +2, you have a higher chance to get attacked, this shield does not prevent your supernatural ability usage",
    "typeLabel": "Shield",
    "remarks": "You can not use stealth or invisibility while this shield is being carried by you",
    "itemLabels": [
      "DR",
      "Stamina",
      "Charisma",
      "Special"
    ]
  },
  {
    "id": "auction-entry-205",
    "sourceRow": 205,
    "bid": 12000,
    "buyout": 33000,
    "itemName": "Farstrike Amulet",
    "itemQuantity": "1",
    "itemQuality": "4. Legendary",
    "bodyPart": "Neck",
    "spec": "When Equipped / Active",
    "bonus": "Per +1, wearer's melee and brawl attacks gain 25 meter attack range. Wearer's perception stat over 5 is added to their melee or brawl damage.",
    "typeLabel": "Amulet",
    "remarks": "Forced by using ophanim eyes",
    "itemLabels": [
      "New",
      "Perception",
      "Special"
    ]
  },
  {
    "id": "auction-entry-206",
    "sourceRow": 206,
    "bid": 7500,
    "buyout": 25000,
    "itemName": "Ring of Discordia",
    "itemQuantity": "Out of Stock",
    "itemQuality": "4. Legendary",
    "bodyPart": "Fingers",
    "spec": "When Equipped / Active",
    "bonus": "Str +1, Stam +1, Dex +1 (stat bonus doubles if the user has lower than -6 Karma)",
    "typeLabel": "Ring",
    "remarks": "",
    "itemLabels": [
      "New",
      "Strength",
      "Stamina",
      "Dexterity",
      "Special"
    ]
  }
];
