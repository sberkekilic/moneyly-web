// ============================================
// CATEGORY MODEL
// Converted from: lib/models/category.dart
// ============================================

export interface CategoryData {
  category: string;
  subcategory: string;
}

export const DEFAULT_CATEGORIES: CategoryData[] = [
  { category: 'Gelir', subcategory: 'Maaş' },
  { category: 'Gelir', subcategory: 'Burs' },
  { category: 'Gelir', subcategory: 'Emekli' },
  { category: 'Faturalar', subcategory: 'Elektrik' },
  { category: 'Faturalar', subcategory: 'Su' },
  { category: 'Faturalar', subcategory: 'Doğalgaz' },
  { category: 'Abonelikler', subcategory: 'TV' },
  { category: 'Abonelikler', subcategory: 'Müzik' },
  { category: 'Abonelikler', subcategory: 'Oyun' },
  { category: 'Abonelikler', subcategory: 'İnternet' },
  { category: 'Abonelikler', subcategory: 'Telefon' },
  { category: 'Gıda', subcategory: 'Market' },
  { category: 'Gıda', subcategory: 'Restoran' },
  { category: 'Ulaşım', subcategory: 'Yakıt' },
  { category: 'Ulaşım', subcategory: 'Toplu Taşıma' },
  { category: 'Diğer', subcategory: 'Genel' },
];