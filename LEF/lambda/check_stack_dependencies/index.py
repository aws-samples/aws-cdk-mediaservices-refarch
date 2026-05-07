import boto3
import os
import json
from urllib.request import urlopen, Request, HTTPError

cfn = boto3.client('cloudformation')

def send_response(event, context, status, reason=None, physical_id=None, data=None):
    body = json.dumps({
        'Status': status,
        'Reason': reason or f'See CloudWatch Log Stream: {context.log_stream_name}',
        'PhysicalResourceId': physical_id or context.log_stream_name,
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'Data': data or {}
    })
    
    req = Request(event['ResponseURL'], data=body.encode('utf-8'), headers={'Content-Type': ''}, method='PUT')
    urlopen(req)  # nosec B310 # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected

def lambda_handler(event, context):
    try:
        request_type = event['RequestType']
        stack_name = os.environ['STACK_NAME']
        physical_id = f'{stack_name}-dependency-check'
        
        if request_type == 'Delete':
            try:
                response = cfn.list_imports(ExportName=stack_name + '-' + os.environ['EXPORT_SUFFIX'])
                imports = response.get('Imports', [])
                
                if imports:
                    send_response(event, context, 'FAILED', 
                                f"Cannot delete stack {stack_name}. Dependent stacks: {', '.join(imports)}", 
                                physical_id)
                    return
            except cfn.exceptions.ClientError as e:
                error_msg = str(e)
                # Allow deletion if export doesn't exist or has no imports
                if 'does not exist' not in error_msg and 'is not imported by any stack' not in error_msg:
                    raise
        
        send_response(event, context, 'SUCCESS', physical_id=physical_id)
        return
    except Exception as e:
        send_response(event, context, 'FAILED', str(e))
        return
