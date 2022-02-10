#!/bin/bash

# author:       Emmanuel Etheve
# email:        ethevee@amazon.com
# description:  This code contain the bash deployment helper script for the LILO application
# created:      21/07/2021 (dd/mm/yyyy)
# modified:     30/08/2021 (dd/mm/yyyy)
# filename:     run.sh

helpFunction()
{
   echo ""
   echo "Usage: $0 -a [deploy | destroy]" # -p <profile>"
   echo -e "\ta: choose between deploy and destroy"
#   echo -e "\tp: aws config profile to be used for deployment"
   exit 1 # Exit script after printing help
}

configFunction()
{
  source .venv/bin/activate
  pip install -r requirements.txt
  cdk bootstrap
}

deployFunction()
{
  export LILOPATH=$(pwd)
  mkdir $LILOPATH/app
  cd $LILOPATH/app || exit
  cdk init app --language=python
  shopt -s dotglob nullglob
  mv $LILOPATH/LILO/* $LILOPATH/app/
  rm -Rf $LILOPATH/LILO
  source .venv/bin/activate
  pip install -r requirements.txt
  cdk bootstrap
  cdk deploy --require-approval never
}

destroyFunction()
{
  export LILOPATH=$(pwd)
  cd "$LILOPATH/app/" || exit
  source .venv/bin/activate
  cdk destroy -f
}

while getopts "a:p:" opt
do
   case "$opt" in
      a ) action="$OPTARG";;
#      p ) profile="$OPTARG";;
      ? ) helpFunction ;; # Print helpFunction in case parameter is non-existent
   esac
done

echo "$0"

# Print helpFunction in case parameters are empty
if [ -z "$action" ] #|| [ -z "$profile" ]
then
   echo "Some or all of the parameters are empty";
   helpFunction
fi

# Begin script in case all parameters are correct
case "$action" in
  configure ) configFunction ;;
  deploy ) deployFunction ;;
  destroy ) destroyFunction ;;
esac
