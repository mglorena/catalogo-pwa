// Detección de plataforma a partir de una URL de red social.
const PLATFORM_RULES = [
  { id: 'instagram', label: 'Instagram', match: /instagram\.com|instagr\.am/i, icon: '📷' },
  { id: 'tiktok', label: 'TikTok', match: /tiktok\.com|vm\.tiktok\.com/i, icon: '🎵' },
  { id: 'youtube', label: 'YouTube', match: /youtube\.com|youtu\.be/i, icon: '▶️' },
  { id: 'x', label: 'X / Twitter', match: /twitter\.com|x\.com/i, icon: '✖️' },
  { id: 'facebook', label: 'Facebook', match: /facebook\.com|fb\.watch/i, icon: '📘' },
];

function detectPlatform(url) {
  if (!url) return { id: 'otro', label: 'Otro', icon: '🔗' };
  const found = PLATFORM_RULES.find((p) => p.match.test(url));
  return found ? { id: found.id, label: found.label, icon: found.icon } : { id: 'otro', label: 'Otro', icon: '🔗' };
}

// Extrae la primera URL válida encontrada dentro de un texto libre
// (útil porque el share target de Android a veces manda la URL dentro de "text").
function extractUrlFromText(text) {
  if (!text) return '';
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : text.trim();
}

window.CatalogoPlatform = { detectPlatform, extractUrlFromText, PLATFORM_RULES };
