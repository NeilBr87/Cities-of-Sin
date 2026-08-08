/**
 * Guns, vehicles and property.
 *
 * Guns  — attack/defence against other players, and a requirement for some crimes.
 * Vehicles — fast travel inside a city, and a requirement for hijacking work.
 *            Cities can only be reached by plane, never by car.
 * Property — bought per district. If you are *inside* your property when someone
 *            comes for you, its safety rating is your defence.
 */

import { eraAllows } from './era';

export const GUNS = [
  { id: 'saturday_special', name: 'Saturday Night Special', price: 400, attack: 4, defence: 2, concealment: 9,
    blurb: 'Cheap, small, and about as reliable as the man selling it.' },
  { id: 'snub_38', name: 'Snub-nose .38', price: 1200, attack: 8, defence: 4, concealment: 8,
    blurb: 'Five shots. Nobody has ever needed the sixth in a doorway.' },
  { id: 'colt_45', name: 'Colt .45', price: 2800, attack: 14, defence: 6, concealment: 6,
    blurb: 'Heavy, loud, and definitive.' },
  { id: 'sawn_off', name: 'Sawn-off Shotgun', price: 4500, attack: 22, defence: 8, concealment: 3,
    blurb: 'Under a long coat. Not a subtle instrument.' },
  { id: 'tommy_gun', name: 'Thompson', price: 11000, attack: 34, defence: 12, concealment: 1,
    blurb: 'A museum piece that still ends arguments.' },
  { id: 'ar_rifle', name: 'Assault Rifle', price: 26000, attack: 48, defence: 16, concealment: 0,
    blurb: 'Wildly illegal in every city, in every era, under every mayor.' },
];

export const ARMOUR = [
  { id: 'vest_light', name: 'Concealed Vest', price: 3200, defence: 14, blurb: 'Stops the small stuff, ruins the suit line.' },
  { id: 'vest_heavy', name: 'Ballistic Plate', price: 9000, defence: 30, blurb: 'You will be slower. You will also be alive.' },
];

export const VEHICLES = [
  { id: 'beater', name: 'Rusted Sedan', price: 900, speed: 3, capacity: 2, heatShed: 0,
    blurb: 'Starts most mornings. Nobody looks twice, which is the point.' },
  { id: 'muscle', name: 'Muscle Car', price: 7500, speed: 8, capacity: 4, heatShed: 1,
    blurb: 'Fast, loud, and memorable — pick two.' },
  { id: 'town_car', name: 'Town Car', price: 14000, speed: 6, capacity: 5, heatShed: 3,
    blurb: 'Tinted, anonymous, and roomy enough for a difficult conversation.' },
  { id: 'panel_van', name: 'Panel Van', price: 11000, speed: 4, capacity: 8, heatShed: 2,
    blurb: 'Required for hijack work. Holds a crew and whatever the crew took.' },
  { id: 'ev_sedan', name: 'Electric Sedan', price: 38000, speed: 9, capacity: 5, heatShed: 5,
    blurb: 'Silent. The single best getaway car ever built, and nobody expects it.' },
  { id: 'private_plane', name: 'Private Plane', price: 450000, speed: 10, capacity: 6, heatShed: 4, halvesFlightTime: true,
    blurb: 'Halves inter-city flight time. Also halves the number of people who see you land.' },
];

export const PROPERTY_TYPES = [
  { id: 'room', name: 'Rented Room', basePrice: 4500, safety: 5, upkeep: 60,
    blurb: 'A door, a lock, and a landlord who talks.' },
  { id: 'apartment', name: 'Apartment', basePrice: 22000, safety: 22, upkeep: 300,
    blurb: 'Third floor, one way in. Buys you time.' },
  { id: 'brownstone', name: 'Brownstone', basePrice: 85000, safety: 45, upkeep: 1100,
    blurb: 'Reinforced door, a back stair, neighbours who saw nothing.' },
  { id: 'compound', name: 'Walled Compound', basePrice: 340000, safety: 78, upkeep: 4200,
    blurb: 'Gate, dogs, sightlines. You do not get taken here.' },
  { id: 'penthouse', name: 'Penthouse', basePrice: 620000, safety: 88, upkeep: 8000,
    blurb: 'One elevator, one doorman, and both of them are on your payroll.' },
];

/**
 * Fronts are the laundering machine: a legitimate business that converts dirty
 * money to clean at a fixed weekly capacity and rate.
 */
export const FRONTS = [
  { id: 'laundromat', name: 'Laundromat', basePrice: 30000, weeklyCapacity: 12000, rate: 0.72, upkeep: 400,
    blurb: 'The original. Coins in, no receipts out.' },
  { id: 'social_club', name: 'Social Club', basePrice: 55000, weeklyCapacity: 26000, rate: 0.75, upkeep: 900,
    blurb: 'Espresso, card tables, and books that balance beautifully.' },
  { id: 'restaurant', name: 'Restaurant', basePrice: 120000, weeklyCapacity: 60000, rate: 0.78, upkeep: 2400,
    blurb: 'Ninety covers a night on paper. Forty in reality.' },
  { id: 'construction_co', name: 'Construction Company', basePrice: 260000, weeklyCapacity: 140000, rate: 0.8, upkeep: 6000,
    blurb: 'Invoices for work nobody can prove did not happen.' },
  { id: 'casino', name: 'Casino Floor', basePrice: 900000, weeklyCapacity: 500000, rate: 0.86, upkeep: 24000, cityId: 'lv',
    blurb: 'The best wash rate in the game. Las Vegas only, obviously.' },
];

export const ALL_ITEMS = [...GUNS, ...ARMOUR, ...VEHICLES];

export const itemById = (id) => ALL_ITEMS.find((i) => i.id === id);
export const propertyTypeById = (id) => PROPERTY_TYPES.find((p) => p.id === id);
export const frontById = (id) => FRONTS.find((f) => f.id === id);

export const availableGuns = () => GUNS.filter((g) => eraAllows(g.id));
export const availableVehicles = () => VEHICLES.filter((v) => eraAllows(v.id));

/** Property prices scale with how rich the district is. */
export function propertyPrice(typeId, district) {
  const t = propertyTypeById(typeId);
  if (!t || !district) return 0;
  return Math.round(t.basePrice * district.wealth);
}
