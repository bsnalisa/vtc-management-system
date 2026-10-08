# Moodle connection

The Moodle screen (Training > Moodle) links a class to a Moodle course, enrols the class's trainees, and brings their grades back for reference.
It is **written against Moodle's documented web-service API but has not been run against a real Moodle site**. Test the connection first.

## One-time set-up in Moodle
1. Site administration > Server > Web services > Enable web services, and enable the REST protocol.
2. Create a service user (for example `vms-sync`) with a role that may create users, enrol users and view grades.
3. Add an external service containing these functions, authorise the user, and create a token:
   `core_webservice_get_site_info`, `core_course_get_courses`, `core_user_get_users_by_field`, `core_user_create_users`,
   `enrol_manual_enrol_users`, `gradereport_user_get_grade_items`.
4. The course must have the **Manual enrolments** method enabled.

## One-time set-up in Supabase
Set these edge-function secrets (Project settings > Edge Functions > Secrets) and deploy `moodle-sync`:

| Secret | Value |
|---|---|
| `MOODLE_URL` | `https://your-moodle.example.org` (no trailing path) |
| `MOODLE_TOKEN` | the web-service token |
| `MOODLE_STUDENT_ROLE_ID` | optional, defaults to 5 (Moodle's Student role) |

One token serves the whole installation, so every centre on it talks to the same Moodle site.

## What it does
- **Link**: remembers which Moodle course belongs to which class.
- **Enrol**: for each active trainee of the class, finds the Moodle user by email, or creates one (Moodle emails them a link to set a password), then enrols them as a student. Trainees with no email address are listed and skipped.
- **Import grades**: copies each linked trainee's Moodle grade items into `moodle_grade_imports`, shown on the Moodle screen. Grades are not written into the gradebook automatically.

Not done: single sign-on, pushing grades from this system to Moodle, un-enrolling trainees who leave a class.
