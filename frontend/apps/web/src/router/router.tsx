import { lazy } from 'react';
import type { ComponentType } from 'react';

import { createBrowserRouter } from 'react-router';
import type { RouteObject } from 'react-router';

import { ConnectedLayout } from './ConnectedLayout';
import { PageRoute } from './PageRoute';
import { RedirectIfAuthenticated } from './RedirectIfAuthenticated';
import { RequireAuth } from './RequireAuth';
import { RootErrorScreen } from './RootErrorScreen';
import { RootLayout } from './RootLayout';
import { ROUTES } from './routes';

/**
 * Page chargée à la demande, dans son propre fichier JavaScript. L'import vise le dossier de la
 * page, jamais un barrel commun : il regrouperait toutes les pages dans le même fichier.
 */
function lazyPage<Name extends string>(
  load: () => Promise<Record<Name, ComponentType>>,
  name: Name,
) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

const LoginPage = lazyPage(() => import('@/pages/LoginPage'), 'LoginPage');
const SignupPage = lazyPage(() => import('@/pages/SignupPage'), 'SignupPage');
const ForgotPasswordPage = lazyPage(
  () => import('@/pages/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const DashboardPage = lazyPage(() => import('@/pages/DashboardPage'), 'DashboardPage');
const CollectionsPage = lazyPage(() => import('@/pages/CollectionsPage'), 'CollectionsPage');
const CollectionDetailPage = lazyPage(
  () => import('@/pages/CollectionDetailPage'),
  'CollectionDetailPage',
);
const AddCardPage = lazyPage(() => import('@/pages/AddCardPage'), 'AddCardPage');
const ProfilePage = lazyPage(() => import('@/pages/ProfilePage'), 'ProfilePage');
const CataloguePage = lazyPage(() => import('@/pages/CataloguePage'), 'CataloguePage');
const SetProgressionPage = lazyPage(
  () => import('@/pages/SetProgressionPage'),
  'SetProgressionPage',
);
const PreGradingPage = lazyPage(() => import('@/pages/PreGradingPage'), 'PreGradingPage');
const SettingsPage = lazyPage(() => import('@/pages/SettingsPage'), 'SettingsPage');
const NotFoundPage = lazyPage(() => import('@/pages/NotFoundPage'), 'NotFoundPage');

/**
 * Route d'une page. La clé distingue chaque page : sans elle, React réutiliserait le même
 * `Suspense` d'une page à l'autre et garderait l'ancienne page affichée pendant le chargement.
 */
function pageRoute(path: string, page: ComponentType): RouteObject {
  return { path, element: <PageRoute key={path} page={page} /> };
}

/** Toutes les routes de l'application web (exportées pour les tests sur un routeur en mémoire). */
export const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    // Erreur hors des pages (gardes comprises) : écran en français, pas celui de React Router.
    errorElement: <RootErrorScreen />,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          pageRoute(ROUTES.login, LoginPage),
          pageRoute(ROUTES.signup, SignupPage),
          pageRoute(ROUTES.forgotPassword, ForgotPasswordPage),
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <ConnectedLayout />,
            children: [
              pageRoute(ROUTES.dashboard, DashboardPage),
              pageRoute(ROUTES.collections, CollectionsPage),
              pageRoute(ROUTES.collection, CollectionDetailPage),
              pageRoute(ROUTES.addCard, AddCardPage),
              pageRoute(ROUTES.profile, ProfilePage),
              pageRoute(ROUTES.catalogue, CataloguePage),
              pageRoute(ROUTES.setProgression, SetProgressionPage),
              pageRoute(ROUTES.preGrading, PreGradingPage),
              pageRoute(ROUTES.settings, SettingsPage),
            ],
          },
        ],
      },
      pageRoute('*', NotFoundPage),
    ],
  },
];

/** Routeur de l'application web, sur l'historique du navigateur. */
export const router = createBrowserRouter(appRoutes);
