Import [JobsParlour.postman_collection.json](/home/fred/workspace/JobsParlourMern/postman/JobsParlour.postman_collection.json) into Postman.

Setup:
- Set `baseUrl` if your API is not `http://localhost:5000`
- Run `Auth -> Login` to populate `token`
- Fill IDs like `jobId`, `applicationId`, `planId`, `paymentId`, and `participantId` as you create records

Notes:
- File-upload requests use `form-data` with empty file placeholders that you can attach in Postman
- Some endpoints are role-restricted, so switch accounts and rerun `Login` when testing employer, jobseeker, or admin flows
- Webhook signing is not automated in this collection; `Payments -> Paystack Webhook` is included as a raw payload template
