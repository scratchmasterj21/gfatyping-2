import { JSXElement } from "solid-js";

import { AvatarModal } from "./AvatarModal";
import { ContactModal } from "./ContactModal";
import { CookiesModal } from "./CookiesModal";
import { CustomTestDurationModal } from "./CustomTestDurationModal";
import { CustomTextModal } from "./CustomTextModal";
import { CustomWordAmountModal } from "./CustomWordAmountModal";
import { LessonIntroModal } from "./LessonIntroModal";
import { LessonIntroVideoModal } from "./LessonIntroVideoModal";
import { MobileTestConfigModal } from "./MobileTestConfigModal";
import { AddPresetModal } from "./preset/AddPresetModal";
import { EditPresetModal } from "./preset/EditPresetModal";
import { QuoteRateModal } from "./QuoteRateModal";
import { QuoteReportModal } from "./QuoteReportModal";
import { QuoteSearchModal } from "./QuoteSearchModal";
import { RegisterCaptchaModal } from "./RegisterCaptchaModal";
import { ShareTestSettings } from "./ShareTestSettings";
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
    </>
  );
}
