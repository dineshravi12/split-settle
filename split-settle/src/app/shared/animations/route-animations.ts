import {
  trigger,
  transition,
  style,
  query,
  animate,
  group,
  animateChild,
} from "@angular/animations";

export const routeAnimations = trigger("routeAnimations", [
  transition("* <=> *", [
    style({ position: "relative" }),
    query(
      ":enter, :leave",
      [
        style({
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
        }),
      ],
      { optional: true },
    ),
    query(":enter", [style({ opacity: 0, transform: "translateX(24px)" })], {
      optional: true,
    }),
    query(":leave", animateChild(), { optional: true }),
    group([
      query(
        ":leave",
        [
          animate(
            "220ms cubic-bezier(0.4, 0, 0.2, 1)",
            style({ opacity: 0, transform: "translateX(-16px)" }),
          ),
        ],
        { optional: true },
      ),
      query(
        ":enter",
        [
          animate(
            "260ms cubic-bezier(0.16, 1, 0.3, 1)",
            style({ opacity: 1, transform: "translateX(0)" }),
          ),
        ],
        { optional: true },
      ),
    ]),
  ]),
]);
