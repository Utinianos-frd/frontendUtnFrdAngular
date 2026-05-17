import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, ButtonModule],
  templateUrl: './not-found.html',
  styles: ``,
})
export class NotFound {
  private location = inject(Location);

  currentYear = new Date().getFullYear();

  goBack() {
    this.location.back();
  }
}
