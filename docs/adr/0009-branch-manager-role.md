# A branch manager is not a second admin

קריית אתא has its own manager (בן גנון) next to Eden, who runs both branches. We added a Branch manager role with an Admin's powers limited to the branches they manage, instead of making him a full Admin. A full Admin sees every branch, including Haifa children's medical notes and parent phones. The money powers that make "admin" matter are per branch anyway: undoing sales, cancellations and refunds. Every Admin still sees what a Branch manager does. The cost is that every admin-only action now has to ask "Admin, or manager of this trainee's branch?" rather than checking one role.

## Storage

A Branch manager is stored as a Trainer whose membership in a branch is marked as managing it, not as a new role value. Around 120 database access rules and 50 code checks grant Trainers what they need, and a new role would have to be added to every one of them; missing one would quietly lock a Branch manager out of something Trainers can do. The admin powers are checked in the application, by one shared check: Admin, or a Trainer who manages that branch.
