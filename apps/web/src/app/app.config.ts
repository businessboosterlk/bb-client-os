import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { CastService } from './core/cast.service';
import { SessionService } from './core/session.service';
import { DataService } from './core/data.service';

/* Boot order: the cast first (it paints the palette), then the session, then the
   data. The hash is the router so a GitHub Pages build deep-links without rewrites. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAppInitializer(async () => {
      const cast = inject(CastService), session = inject(SessionService), data = inject(DataService);
      const c = await cast.load();
      if (c) { session.restore(); await data.init(); }
    })
  ]
};
