export function formatDateTime(isoString) {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function getDaysRemaining(expiryDateStr) {
  if (!expiryDateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr + 'T00:00:00');
  expiry.setHours(0, 0, 0, 0);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getCardTypeLabel(type) {
  switch (type) {
    case 'count': return '次卡';
    case 'month': return '月卡';
    case 'year': return '年卡';
    default: return type;
  }
}

export function getDefaultExpiry(startDate, cardType) {
  const start = new Date(startDate + 'T00:00:00');
  if (cardType === 'month') {
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    return end.toISOString().split('T')[0];
  } else if (cardType === 'year') {
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
    return end.toISOString().split('T')[0];
  }
  return '';
}

export function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
