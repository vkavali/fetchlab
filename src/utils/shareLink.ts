import type { Collection, RequestConfig } from '../types';
import { collectionToShareableJson, requestToShareableJson } from './helpers';

/**
 * Encode data into a compressed base64 string for URL sharing.
 * Uses TextEncoder + btoa for browser-native compression.
 */
function compressToBase64(data: unknown): string {
  const json = JSON.stringify(data);
  // Use encodeURIComponent to handle unicode, then btoa for base64
  const encoded = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  ));
  return encoded;
}

/**
 * Decode a base64 string back to data.
 */
function decompressFromBase64(encoded: string): unknown {
  try {
    const json = decodeURIComponent(
      Array.from(atob(encoded), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Generate a shareable URL for a collection or request.
 * The data is encoded in the URL hash (never sent to a server).
 */
export function generateShareLink(target: { type: 'collection'; collection: Collection } | { type: 'request'; request: RequestConfig }): string {
  const payload = target.type === 'collection'
    ? collectionToShareableJson(target.collection)
    : requestToShareableJson(target.request);

  const encoded = compressToBase64(payload);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#share=${encoded}`;
}

/**
 * Check if the current URL has shared data and extract it.
 * Returns null if no shared data.
 */
export function extractSharedData(): { type: string; data: unknown } | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;

  const encoded = hash.substring('#share='.length);
  const data = decompressFromBase64(encoded) as Record<string, unknown> | null;
  if (!data || !data._fetchlab) return null;

  return {
    type: (data._type as string) || 'unknown',
    data,
  };
}

/**
 * Clear the share hash from the URL without reloading.
 */
export function clearShareHash() {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

/**
 * Generate a team sync file content — designed for git repos.
 * Includes metadata, timestamp, and all collections.
 */
export function generateTeamSyncFile(collections: Collection[], envName?: string): string {
  return JSON.stringify({
    _fetchlab: '1.0',
    _type: 'team-sync',
    _exportedAt: new Date().toISOString(),
    _exportedBy: envName || 'FetchLab User',
    collections: collections.map(c => collectionToShareableJson(c)),
  }, null, 2);
}
