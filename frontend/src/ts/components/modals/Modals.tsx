import { JSXElement } from "solid-js";

import { AchievementsModal } from "./AchievementsModal";
import { AvatarModal } from "./AvatarModal";
import { BackdropShopModal } from "./BackdropShopModal";
import { CaretEffectShopModal } from "./CaretEffectShopModal";
import { ContactModal } from "./ContactModal";
import { CookiesModal } from "./CookiesModal";
import { CustomTestDurationModal } from "./CustomTestDurationModal";
import { CustomTextModal } from "./CustomTextModal";
import { CustomWordAmountModal } from "./CustomWordAmountModal";
import { HandsShopModal } from "./HandsShopModal";
import { HouseModal } from "./HouseModal";
import { HouseShopModal } from "./HouseShopModal";
import { KeyboardSkinShopModal } from "./KeyboardSkinShopModal";
import { KeypressEffectShopModal } from "./KeypressEffectShopModal";
import { LessonIntroModal } from "./LessonIntroModal";
import { LessonIntroVideoModal } from "./LessonIntroVideoModal";
import { MobileTestConfigModal } from "./MobileTestConfigModal";
import { PetShopModal } from "./PetShopModal";
import { AddPresetModal } from "./preset/AddPresetModal";
import { EditPresetModal } from "./preset/EditPresetModal";
import { QuoteRateModal } from "./QuoteRateModal";
import { QuoteReportModal } from "./QuoteReportModal";
import { QuoteSearchModal } from "./QuoteSearchModal";
import { RegisterCaptchaModal } from "./RegisterCaptchaModal";
import { RgbPaletteShopModal } from "./RgbPaletteShopModal";
import { ShareTestSettings } from "./ShareTestSettings";
import { SideImagesModal } from "./SideImagesModal";
import { SimpleModal } from "./SimpleModal";
import { SupportModal } from "./SupportModal";
import { VersionHistoryModal } from "./VersionHistoryModal";

export function Modals(): JSXElement {
  return (
    <>
      <VersionHistoryModal />
      <ContactModal />
      <RegisterCaptchaModal />
      <SupportModal />
      <SimpleModal />
      <CustomTextModal />
      <QuoteRateModal />
      <QuoteReportModal />
      <QuoteSearchModal />
      <CustomTestDurationModal />
      <CustomWordAmountModal />
      <ShareTestSettings />
      <MobileTestConfigModal />
      <CookiesModal />
      <AddPresetModal />
      <EditPresetModal />
      <LessonIntroModal />
      <LessonIntroVideoModal />
      <AvatarModal />
      <SideImagesModal />
      <HouseModal />
      <HouseShopModal />
      <PetShopModal />
      <HandsShopModal />
      <RgbPaletteShopModal />
      <KeyboardSkinShopModal />
      <KeypressEffectShopModal />
      <CaretEffectShopModal />
      <BackdropShopModal />
      <AchievementsModal />
    </>
  );
}
