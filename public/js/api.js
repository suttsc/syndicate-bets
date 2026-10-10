// Data access. Phase 1 serves mock data; phase 2 switches these to /api/* Pages Functions.
import { mockFixtures, mockScenario } from './mock-data.js';

const USE_MOCK = true;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @returns {Promise<{picks: Array, events: Array, theGuy: string|null, updatedAt: string}>} picks with their matched events */
export async function loadBoard() {
  if (USE_MOCK) {
    await delay(300);
    return mockScenario();
  }

  throw new Error('Live API not wired up yet');
}

/** @returns {Promise<Array>} normalised events for a league on a YYYY-MM-DD date */
export async function loadFixtures(league, date) {
  if (USE_MOCK) {
    await delay(400);
    return mockFixtures(league, date);
  }

  throw new Error('Live API not wired up yet');
}

/** @param {{picks: Array, theGuy: string}} week */
export async function savePicks(week, password) {
  if (USE_MOCK) {
    await delay(600);
    if (password !== 'demo') {
      throw new Error('Wrong password (use "demo" in design mode)');
    }
    return { ...week, updatedAt: new Date().toISOString() };
  }

  throw new Error('Live API not wired up yet');
}
