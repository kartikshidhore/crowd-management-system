import { TestBed } from '@angular/core/testing';

import { DashboardLoaderService } from './dashboard-loader.service';

describe('DashboardLoaderService', () => {
  let service: DashboardLoaderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DashboardLoaderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
