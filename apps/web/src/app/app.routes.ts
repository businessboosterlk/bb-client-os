import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SessionService } from './core/session.service';
import { LoginComponent } from './pages/login.component';
import { LauncherComponent } from './pages/launcher.component';
import { ShellComponent } from './shell/shell.component';
import { MonthComponent } from './pages/library/month.component';
import { VideosComponent } from './pages/library/videos.component';
import { PostsComponent } from './pages/library/posts.component';
import { DocsComponent } from './pages/library/docs.component';
import { BusinessComponent } from './pages/library/business.component';
import { DashboardComponent } from './pages/sales/dashboard.component';
import { EnquiriesComponent } from './pages/sales/enquiries.component';
import { PipelineComponent } from './pages/sales/pipeline.component';
import { CustomersComponent } from './pages/sales/customers.component';
import { TasksComponent } from './pages/sales/tasks.component';

const signedIn: CanActivateFn = () => {
  const s = inject(SessionService), r = inject(Router);
  return s.user() ? true : r.createUrlTree(['/login']);
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'start' },
  { path: 'login', component: LoginComponent },
  { path: 'start', component: LauncherComponent, canActivate: [signedIn] },
  { path: 'library', component: ShellComponent, canActivate: [signedIn], data: { system: 'library' }, children: [
    { path: '', pathMatch: 'full', redirectTo: 'month' },
    { path: 'month', component: MonthComponent, data: { title: 'This month' } },
    { path: 'videos', component: VideosComponent, data: { title: 'Videos' } },
    { path: 'posts', component: PostsComponent, data: { title: 'Posts' } },
    { path: 'docs', component: DocsComponent, data: { title: 'Documents' } },
    { path: 'business', component: BusinessComponent, data: { title: 'Your business' } }
  ] },
  { path: 'sales', component: ShellComponent, canActivate: [signedIn], data: { system: 'sales' }, children: [
    { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    { path: 'dashboard', component: DashboardComponent, data: { title: 'Dashboard' } },
    { path: 'enquiries', component: EnquiriesComponent, data: { title: 'Enquiries' } },
    { path: 'pipeline', component: PipelineComponent, data: { title: 'Pipeline' } },
    { path: 'customers', component: CustomersComponent, data: { title: 'Customers' } },
    { path: 'tasks', component: TasksComponent, data: { title: 'Tasks' } }
  ] },
  { path: '**', redirectTo: 'start' }
];
