import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SessionService } from './core/session.service';
import { LoginComponent } from './pages/login.component';
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
import { FollowUpsComponent } from './pages/sales/follow-ups.component';

const signedIn: CanActivateFn = () => {
  const s = inject(SessionService), r = inject(Router);
  return s.user() ? true : r.createUrlTree(['/login']);
};

import { ChatComponent } from './pages/work/chat.component';
import { WorkTasksComponent } from './pages/work/tasks.component';
import { WorkPostsComponent } from './pages/work/posts.component';

/* ONE SHELL, ONE BAR, FIVE PLACES (24 Oct 2026): Chat opens first, then Posts, Tasks, Sales and Library. The launcher
   with two doors is gone: the bar is the door now. Old addresses (/start, /sales/tasks) still land somewhere true. */
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'start', pathMatch: 'full', redirectTo: 'chat' },
  { path: '', component: ShellComponent, canActivate: [signedIn], children: [
    { path: '', pathMatch: 'full', redirectTo: 'chat' },
    { path: 'chat', component: ChatComponent, data: { title: 'Chat', group: 'work' } },
    { path: 'posts', component: WorkPostsComponent, data: { title: 'Posts', group: 'work' } },
    { path: 'tasks', component: WorkTasksComponent, data: { title: 'Tasks', group: 'work' } },
    { path: 'library', pathMatch: 'full', redirectTo: 'library/month' },
    { path: 'library/month', component: MonthComponent, data: { title: 'This month', group: 'library' } },
    { path: 'library/videos', component: VideosComponent, data: { title: 'Videos', group: 'library' } },
    { path: 'library/posts', component: PostsComponent, data: { title: 'Posts', group: 'library' } },
    { path: 'library/docs', component: DocsComponent, data: { title: 'Documents', group: 'library' } },
    { path: 'library/business', component: BusinessComponent, data: { title: 'Your business', group: 'library' } },
    { path: 'sales', pathMatch: 'full', redirectTo: 'sales/dashboard' },
    { path: 'sales/dashboard', component: DashboardComponent, data: { title: 'Dashboard', group: 'sales' } },
    { path: 'sales/enquiries', component: EnquiriesComponent, data: { title: 'Enquiries', group: 'sales' } },
    { path: 'sales/pipeline', component: PipelineComponent, data: { title: 'Pipeline', group: 'sales' } },
    { path: 'sales/customers', component: CustomersComponent, data: { title: 'Customers', group: 'sales' } },
    { path: 'sales/follow-ups', component: FollowUpsComponent, data: { title: 'Follow ups', group: 'sales' } },
    { path: 'sales/tasks', pathMatch: 'full', redirectTo: 'sales/follow-ups' }
  ] },
  { path: '**', redirectTo: 'chat' }
];
