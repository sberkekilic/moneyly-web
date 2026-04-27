import { CategoryData, DEFAULT_CATEGORIES } from '@/models/category';
import { storage, KEYS } from './storage';

export const CategoryService = {
  load: (): CategoryData[] => {
    return storage.get<CategoryData[]>(KEYS.USER_CATEGORIES, DEFAULT_CATEGORIES) ?? DEFAULT_CATEGORIES;
  },
  save: (list: CategoryData[]): void => {
    storage.set(KEYS.USER_CATEGORIES, list);
  },
  add: (item: CategoryData): void => {
    const list = CategoryService.load();
    list.push(item);
    CategoryService.save(list);
  },
};