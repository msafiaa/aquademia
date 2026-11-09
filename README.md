# aquademia

## AquaPlan

AquaPlan is the personalised, seven-day study planner at `/aquaplan`. It ranks
skills from a student's quiz mistakes, respects selected free days and 10/20/30
minute study limits, and schedules recall missions on days 1, 3 and 7. Students
earn 5 pearls for each completed mission; finishing every mission also grants
25 pearls and a shop decoration (when one is available). A plan can be
edited any time during its seven-day period, or recalibrated from a new quiz;
completed missions and rewards are preserved to prevent duplicate claims.
Students can add timed personal events to a day; marking a day busy moves its
unfinished AI missions to a separate catch-up day without exceeding the daily
study-time limit.

The planner's `aqua_plans`, `aqua_plan_completions`, and `aqua_plan_rewards`
tables are provisioned automatically when AquaPlan or the shop is first used.
Pearl rewards are included in the existing wallet balance.