// ============================================
// FORM DATA MODEL
// Converted from: lib/models/form-data.dart
// ============================================

export interface FormData {
  hasTVSelected: boolean;
  hasGameSelected: boolean;
  hasMusicSelected: boolean;
  hasHomeSelected: boolean;
  hasInternetSelected: boolean;
  hasPhoneSelected: boolean;
  hasRentSelected: boolean;
  hasKitchenSelected: boolean;
  hasCateringSelected: boolean;
  hasEntertainmentSelected: boolean;
  hasOtherSelected: boolean;

  tvTitleList: string[];
  gameTitleList: string[];
  musicTitleList: string[];
  homeBillsTitleList: string[];
  internetTitleList: string[];
  phoneTitleList: string[];
  rentTitleList: string[];
  kitchenTitleList: string[];
  cateringTitleList: string[];
  entertainmentTitleList: string[];
  otherTitleList: string[];

  tvPriceList: string[];
  gamePriceList: string[];
  musicPriceList: string[];
  homeBillsPriceList: string[];
  internetPriceList: string[];
  phonePriceList: string[];
  rentPriceList: string[];
  kitchenPriceList: string[];
  cateringPriceList: string[];
  entertainmentPriceList: string[];
  otherPriceList: string[];

  sumOfTV: number;
  sumOfGame: number;
  sumOfMusic: number;
  sumOfHomeBills: number;
  sumOfInternet: number;
  sumOfPhone: number;
  sumOfRent: number;
  sumOfKitchen: number;
  sumOfCatering: number;
  sumOfEnt: number;
  sumOfOther: number;
}

export const createEmptyFormData = (): FormData => ({
  hasTVSelected: false,
  hasGameSelected: false,
  hasMusicSelected: false,
  hasHomeSelected: false,
  hasInternetSelected: false,
  hasPhoneSelected: false,
  hasRentSelected: false,
  hasKitchenSelected: false,
  hasCateringSelected: false,
  hasEntertainmentSelected: false,
  hasOtherSelected: false,
  tvTitleList: [], gameTitleList: [], musicTitleList: [],
  homeBillsTitleList: [], internetTitleList: [], phoneTitleList: [],
  rentTitleList: [], kitchenTitleList: [], cateringTitleList: [],
  entertainmentTitleList: [], otherTitleList: [],
  tvPriceList: [], gamePriceList: [], musicPriceList: [],
  homeBillsPriceList: [], internetPriceList: [], phonePriceList: [],
  rentPriceList: [], kitchenPriceList: [], cateringPriceList: [],
  entertainmentPriceList: [], otherPriceList: [],
  sumOfTV: 0, sumOfGame: 0, sumOfMusic: 0, sumOfHomeBills: 0,
  sumOfInternet: 0, sumOfPhone: 0, sumOfRent: 0, sumOfKitchen: 0,
  sumOfCatering: 0, sumOfEnt: 0, sumOfOther: 0,
});