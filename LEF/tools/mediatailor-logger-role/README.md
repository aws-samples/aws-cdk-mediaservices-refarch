# Setting up MediaTailor permissions for Amazon CloudWatch

For any MediaTailor workflow it is extremely important for at least some CloudWatch logging to be enabled. These logs provide vital insight into the operation of the workflow.

MediaTailor is granted permissions to log to CloudWatch by creating a role called 'MediaTailorLogger' and attaching the CloudWatchLogsFullAccess and CloudWatchFullAccess managed policies.

When the Live Event Framework Foundation stack is deployed a check is performed to verify the MediaTailorLogger role exists and has appropriate permissions. If the role does not exist or does not have appropriate permissions the CDK deployment will fail.

The **_tools/mediatailor-logger-role/check_mediatailor_logger_role.py_** script simplifies the creation of the MediaTailorLogger role in your account. For detailed instructions on creating the role manually see [Setting up permissions for Amazon CloudWatch](https://docs.aws.amazon.com/mediatailor/latest/ug/monitoring-permissions.html).

The MediaTailorLogger role only needs to be created in the account once. After the role is created the level of logging for each MediaTailor Configuration is determine by the log percentage set on the individual MediaTailor Configurations.

**Note:** If the MediaTailorLogger role is not created with the required permissions MediaTailor will be unable to any events to CloudWatch.

During development and integration where the volume of requests is relatively small it makes sense to log 100% of requests ensure logs are available for any failing test cases. As the workload moves to production the volume (and corresponding cost) of MediaTailor logging will increase significantly. For a production workload a log sampling level of 10% or less is recommended to minimise costs while retaining a reasonable level of observability on the workload.

Below is an example command to run the **_tools/mediatailor-logger-role/check_mediatailor_logger_role.py_** script. This script will check if the MediaTailorLogger role exists. If the role does not exist the user will be prompted with an option for the script to create the role.

```bash
# Create Python virtual environment to run scripts (if local Python is not being used)
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt

tools/mediatailor-logger-role/check_mediatailor_logger_role.py [--profile AWS_PROFILE] [--region AWS_REGION]
```
