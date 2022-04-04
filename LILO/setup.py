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
        "aws-cdk-lib>=2.0.0",
        "constructs>=10.0.0",
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
