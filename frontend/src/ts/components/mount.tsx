import { QueryClientProvider } from "@tanstack/solid-query";
import { JSXElement } from "solid-js";
import { render } from "solid-js/web";

import { queryClient } from "../queries";
import { qsa } from "../utils/dom";
import { CelebrationOverlay } from "./common/CelebrationOverlay";
import { CaretEffectController } from "./core/CaretEffectController";
import { Theme } from "./core/Theme";
import { DevTools } from "./dev/DevTools";
import { CommandlineHotkey } from "./hotkeys/CommandlineHotkey";
import { Footer } from "./layout/footer/Footer";
import { Header } from "./layout/header/Header";
import { Overlays } from "./layout/overlays/Overlays";
import { Modals } from "./modals/Modals";
import { NotFoundPage } from "./pages/404Page";
import { AboutPage } from "./pages/AboutPage";
import { BlockedUsers } from "./pages/account-settings/BlockedUsers";
import { AccountPage } from "./pages/account/AccountPage";
import { MyProfile } from "./pages/account/MyProfile";
import { CertificatePage } from "./pages/certificate/CertificatePage";
import { ClassroomDashboard } from "./pages/classroom/ClassroomDashboard";
import { FriendsPage } from "./pages/connections/FriendsPage";
import { LeaderboardPage } from "./pages/leaderboard/LeaderboardPage";
import { LessonsPage } from "./pages/lessons/LessonsPage";
import { LoginPage } from "./pages/login/LoginPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { ProfileSearchPage } from "./pages/profile/ProfileSearchPage";
import { RaceHostPage } from "./pages/race/RaceHostPage";
import { RacePage } from "./pages/race/RacePage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { AnimatedHands } from "./pages/test/AnimatedHands";
import { FingerLegend } from "./pages/test/FingerLegend";
import { TestModesNotice } from "./pages/test/modes-notice/TestModesNotice";
import { SideImagePanels } from "./pages/test/SideImagePanels";
import { TestConfig } from "./pages/test/TestConfig";
import { Popups } from "./popups/Popups";
import { RaceOverlay } from "./race/RaceOverlay";

const components: Record<string, () => JSXElement> = {
  footer: () => <Footer />,
  aboutpage: () => <AboutPage />,
  settingspage: () => <SettingsPage />,
  accountpage: () => <AccountPage />,
  loginpage: () => <LoginPage />,
  leaderboardpage: () => <LeaderboardPage />,
  lessonspage: () => <LessonsPage />,
  classroompage: () => <ClassroomDashboard />,
  certificatepage: () => <CertificatePage />,
  racepage: () => <RacePage />,
  racehostpage: () => <RaceHostPage />,
  raceoverlay: () => <RaceOverlay />,
  celebrationoverlay: () => <CelebrationOverlay />,
  profilepage: () => <ProfilePage />,
  profilesearchpage: () => <ProfileSearchPage />,
  myprofile: () => <MyProfile />,
  modals: () => <Modals />,
  caretfx: () => <CaretEffectController />,
  popups: () => <Popups />,
  overlays: () => <Overlays />,
  theme: () => <Theme />,
  header: () => <Header />,
  devtools: () => <DevTools />,
  testconfig: () => <TestConfig />,
  commandlinehotkey: () => <CommandlineHotkey />,
  testmodesnotice: () => <TestModesNotice />,
  fingerlegend: () => <FingerLegend />,
  animatedhands: () => <AnimatedHands />,
  friendspage: () => <FriendsPage />,
  blockedusers: () => <BlockedUsers />,
  sideimagepanels: () => <SideImagePanels />,
  notfoundpage: () => <NotFoundPage />,
};

function mountToMountpoint(name: string, component: () => JSXElement): void {
  for (const mountPoint of qsa(name)) {
    render(
      () => (
        <QueryClientProvider client={queryClient}>
          {component()}
        </QueryClientProvider>
      ),
      mountPoint.native,
    );
  }
}

export function mountComponents(): void {
  for (const [query, component] of Object.entries(components)) {
    mountToMountpoint(`mount[data-component=${query}]`, component);
  }
}
