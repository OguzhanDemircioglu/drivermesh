// Guided tour adımları — demo modunda kullanıcıyı sayfa sayfa gezdirir.
//
// Her step ya CTA ile manuel ilerler (waitForRoute yoksa) ya da
// kullanıcı belirtilen route'a gittiğinde otomatik next olur.

export interface TourStep {
  id: string;
  route: string;
  /** Bot tooltip başlığı (i18n key) */
  titleKey: string;
  /** Bot tooltip metni (i18n key) */
  bodyKey: string;
  /** Kullanıcı bu route'a giderse otomatik ilerle (waitForRoute=true). */
  waitForRoute?: string;
  /** Son adımsa "Bitir" yazısı, ortadaysa "Devam". */
  isFinal?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'home-welcome',
    route: '/(app)/',
    titleKey: 'chatbot.tour.step1Title',
    bodyKey: 'chatbot.tour.step1Body',
  },
  {
    id: 'home-fleet-rhythm',
    route: '/(app)/',
    titleKey: 'chatbot.tour.step2Title',
    bodyKey: 'chatbot.tour.step2Body',
  },
  {
    id: 'home-quick-actions',
    route: '/(app)/',
    titleKey: 'chatbot.tour.step3Title',
    bodyKey: 'chatbot.tour.step3Body',
  },
  {
    id: 'nav-jobs',
    route: '/(app)/',
    titleKey: 'chatbot.tour.step4Title',
    bodyKey: 'chatbot.tour.step4Body',
    waitForRoute: '/(app)/jobs',
  },
  {
    id: 'jobs-list',
    route: '/(app)/jobs',
    titleKey: 'chatbot.tour.step5Title',
    bodyKey: 'chatbot.tour.step5Body',
  },
  {
    id: 'nav-fleet',
    route: '/(app)/jobs',
    titleKey: 'chatbot.tour.step6Title',
    bodyKey: 'chatbot.tour.step6Body',
    waitForRoute: '/(app)/vehicles',
  },
  {
    id: 'vehicles-list',
    route: '/(app)/vehicles',
    titleKey: 'chatbot.tour.step7Title',
    bodyKey: 'chatbot.tour.step7Body',
  },
  {
    id: 'nav-account',
    route: '/(app)/vehicles',
    titleKey: 'chatbot.tour.step8Title',
    bodyKey: 'chatbot.tour.step8Body',
    waitForRoute: '/(app)/account',
  },
  {
    id: 'account-overview',
    route: '/(app)/account',
    titleKey: 'chatbot.tour.step9Title',
    bodyKey: 'chatbot.tour.step9Body',
  },
  {
    id: 'final',
    route: '/(app)/account',
    titleKey: 'chatbot.tour.step10Title',
    bodyKey: 'chatbot.tour.step10Body',
    isFinal: true,
  },
];
