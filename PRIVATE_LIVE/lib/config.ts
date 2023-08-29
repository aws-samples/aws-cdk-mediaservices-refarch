// Edit to use your desired configuration

/**
 * MediaConnect Whitelist CIDR - this is to narrow down traffic to ensure that you are only receiving traffic from your upstream system.
 */
export const MEDIA_CONNECT_INPUT_WHITELIST_CIDR = "0.0.0.0/0"; // Change to lockdown your source IP address

/**
 * Output URL for MSS Output Group
 * This IP Address is a example destination in the private subnet created in the network stack.
 *
 * https://docs.aws.amazon.com/medialive/latest/ug/origin-server-mss.html
 */
export const MEDIA_LIVE_OUTPUT_TARGET = "http://<ip-address-in-private-subnet>/channel1/channel1";

/**
 * Used in VPC creation and network lookups
 */
export const AVAILABILITY_ZONES = ["eu-west-1a", "eu-west-1b"];

/**
 * CIDR Address for VPC creation and configuration
 */
export const VPC_CIDR = "10.0.0.0/16";
