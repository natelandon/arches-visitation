export const formatNumber = (num: number): string => {
  // Shorten by size, keeping the sign, so a decline reads "-421.6K" like a rise reads "568.8K"
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
};
