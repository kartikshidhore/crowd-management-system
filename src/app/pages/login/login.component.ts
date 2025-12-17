import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { SiteService } from '../../services/site/site.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-login',
  
  standalone: true, 
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  imports: [
      CommonModule,
      MatCardModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatFormFieldModule,
      ReactiveFormsModule,
      
  ]
})
export class Login {
  loginForm : FormGroup;
  errorMessage : string = '';
  isLoading : boolean = false;
  showPassword : boolean = false;

  constructor(
    private fb : FormBuilder,
    private auth : AuthService,
    private router : Router,
    private cdr : ChangeDetectorRef,
    private siteService: SiteService
  ) {
    this.loginForm = this.fb.group({
      username : ['', [Validators.required, Validators.email]],
      password : ['', [Validators.required]],
    })
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  OnSubmit(){
    if(this.loginForm.invalid) return;

    this.isLoading =true;
    this.errorMessage = '';
    const payload = {
      email : this.loginForm.value.username,
      password : this.loginForm.value.password
    }
    this.auth.login(payload)
    .pipe(
      finalize(() => {
        this.isLoading= false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: () => {
        console.log("Login Successful with token!");
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error("Login Error:", err);
        this.errorMessage = "Invalid credentials. Please try again";
        this.isLoading = false;
        this.cdr.detectChanges();
      } 
    });

  }

}
