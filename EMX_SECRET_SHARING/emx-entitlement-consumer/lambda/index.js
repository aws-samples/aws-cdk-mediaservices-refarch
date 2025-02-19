const sm = require("@aws-sdk/client-secrets-manager");

exports.handler = async function (event, context) {

    try {

        const smclient = new sm.SecretsManagerClient({});
        const smresponse = await smclient.send(
          new sm.GetSecretValueCommand({
            SecretId: process.env.GRANTED_SECRET,
          }),
        );
        
        await smclient.send(
          new sm.UpdateSecretCommand({
            SecretId: process.env.CONSUMER_SECRET,
            SecretString: smresponse.SecretString,
          }),
        );

      } catch (err) {
        console.error(err);
      }

    return "OK";
};