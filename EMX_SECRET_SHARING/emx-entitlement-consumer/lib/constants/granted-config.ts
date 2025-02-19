/**
 * 3 ARN's below need to be the values in the "granter" account
 *
 * Can be found in the outputs of the stack created in the other account
 */

/**
 * EMX Entitlement ARN from Granted account
 *
 * Can be found in the "Resources" tab on the CloudFormation stack
 */
export const ENTITLEMENT_ARN = "arn:aws:mediaconnect:....";

/**
 * ARN of the secret in the Granted account
 */
export const SECRET_ARN = "arn:aws:secretsmanager:....";

/**
 * If you haven't been provided an SNS Topic ARN - set this to `undefined`
 */
export const SNS_ARN = "arn:aws:sns:....";

