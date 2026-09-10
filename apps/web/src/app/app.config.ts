import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { CastService } from './core/cast.service';
import { SessionService } from './core/session.service';
import { DataService } from './core/data.service';

/* Boot: the runtime config (where the API is), then a saved session if there is one,
   which carries the cast and paints the palette, then the data. No session means the
   door. The hash is the router so GitHub Pages deep-links without rewrites. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAppInitializer(async () => {
      const cast = inject(CastService), session = inject(SessionService), data = inject(DataService);
      await cast.loadConfig();
      if (session.restore()) await data.init();
    })
  ]
};
