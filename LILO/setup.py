import setuptools


with open("README.md") as fp:
    long_description = fp.read()


setuptools.setup(
    name="lilo",
    version="0.0.1",

    description="Live encoding loop application using AWS S3 and AWS Elemental MediaLive",
    long_description=long_description,
    long_description_content_type="text/markdown",

    author="Emmanuel Etheve",

    package_dir={"": "lilo"},
    packages=setuptools.find_packages(where="lilo"),

    install_requires=[
        "aws-cdk.core==1.116.0",
        "aws_cdk.aws_medialive==1.116.0",
        "aws_cdk.aws_iam==1.116.0",
        "aws-cdk.aws-lambda==1.116.0",
        "aws_cdk.aws_events==1.116.0",
        "aws_cdk.aws_lambda_event_sources==1.116.0",
        "aws_cdk.aws_events_targets==1.116.0",
        "aws_cdk.aws_codepipeline==1.116.0",
        "aws_cdk.aws_codepipeline_actions==1.116.0",
        "aws_cdk.pipelines==1.116.0",
        "aws_cdk.aws_codecommit==1.116.0",
        "boto3",
    ],

    python_requires=">=3.6",

    classifiers=[
        "Development Status :: 4 - Beta",

        "Intended Audience :: Developers",

        "Programming Language :: JavaScript",
        "Programming Language :: Python :: 3 :: Only",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",

        "Topic :: Software Development :: Code Generators",
        "Topic :: Utilities",

        "Typing :: Typed",
    ],
)
