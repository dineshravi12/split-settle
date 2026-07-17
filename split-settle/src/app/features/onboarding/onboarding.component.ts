import { Component, HostListener, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import {
  trigger,
  transition,
  animate,
  style,
} from "@angular/animations";

interface Step {
  title: string;
  body: string;
  illustration: "groups" | "friends" | "expenses";
}

@Component({
  selector: "app-onboarding",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./onboarding.component.html",
  styleUrls: ["./onboarding.component.scss"],
  animations: [
    trigger("stepIn", [
      transition(":enter", [
        style({ opacity: 0, transform: "translateY(16px) scale(0.98)" }),
        animate(
          "360ms cubic-bezier(0.16, 1, 0.3, 1)",
          style({ opacity: 1, transform: "translateY(0) scale(1)" }),
        ),
      ]),
    ]),
  ],
})
export class OnboardingComponent implements OnInit {
  private router = inject(Router);

  readonly steps: Step[] = [
    {
      title: "Create a group",
      body: "Start a group for your trip, apartment or side project. You can create as many as you need.",
      illustration: "groups",
    },
    {
      title: "Add friends by email",
      body: "Invite the people you split with. They'll show up as members inside the group.",
      illustration: "friends",
    },
    {
      title: "Log expenses — we do the math",
      body: "Log an expense once and Split & Settle auto-calculates who owes whom, down to the last rupee.",
      illustration: "expenses",
    },
  ];

  index = signal(0);

  ngOnInit(): void {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("onboarded") === "true") {
      this.router.navigate(["/dashboard"], { replaceUrl: true });
    }
  }

  get step(): Step {
    return this.steps[this.index()];
  }

  next(): void {
    if (this.index() < this.steps.length - 1) {
      this.index.update((v) => v + 1);
    } else {
      this.finish();
    }
  }

  prev(): void {
    if (this.index() > 0) {
      this.index.update((v) => v - 1);
    }
  }

  skip(): void {
    this.finish();
  }

  finish(): void {
    try {
      localStorage.setItem("onboarded", "true");
      localStorage.removeItem("split_needs_onboarding");
    } catch {
      /* ignore */
    }
    this.router.navigate(["/dashboard"], { replaceUrl: true });
  }

  goTo(i: number): void {
    this.index.set(i);
  }

  isLast(): boolean {
    return this.index() === this.steps.length - 1;
  }

  @HostListener("document:keydown.arrowright")
  keyNext(): void {
    this.next();
  }

  @HostListener("document:keydown.arrowleft")
  keyPrev(): void {
    this.prev();
  }

  @HostListener("document:keydown.escape")
  keyEscape(): void {
    this.skip();
  }
}
