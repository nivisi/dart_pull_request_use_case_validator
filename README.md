# Dart Pull Request Use Case Validator [![version][version-img]][version-url]

This action validates your code base to have correct use case classes.

### Table of contents

- [How it works](https://github.com/nivisi/dart_pull_request_use_case_validator#how-it-works)
  - [Example](https://github.com/nivisi/dart_pull_request_use_case_validator#example)
  - [Reports](https://github.com/nivisi/dart_pull_request_use_case_validator#reports)
  - [Validation rules](https://github.com/nivisi/dart_pull_request_use_case_validator#validation-rules)
- [Setup](https://github.com/nivisi/dart_pull_request_use_case_validator#setup)
- [Note ❗](https://github.com/nivisi/dart_pull_request_use_case_validator#note-%EF%B8%8F)

## How it works

### Example

Check out the [example repository](https://github.com/nivisi/dart_pull_request_use_case_validator_example) with two Pull Requests: [valid](https://github.com/nivisi/dart_pull_request_use_case_validator_example/pull/2) and [invalid](https://github.com/nivisi/dart_pull_request_use_case_validator_example/pull/1).

### Reports

If this action will find issues, it will request changes. If possible, it will point out on the problems and will suggest how to fix them.

<img width="800" alt="Screenshot 2022-07-11 at 16 46 39" src="https://user-images.githubusercontent.com/33932162/178278814-4af4743a-756f-4812-9f0a-889c044291f3.png">

If no issues were found, the bot will approve the PR:

<img width="800" alt="Screenshot 2022-07-11 at 16 47 58" src="https://user-images.githubusercontent.com/33932162/178279044-a4fdf507-7d2d-4f09-94d6-4cb4df6c75f1.png">

### Validation rules

- The name of a use case file ends with `_use_case.dart`;
- That class must match the file name, e.g. for `my_super_use_case.dart` it would be `MySuperUseCase`;
- The use case class must contain only one callable public method. The name of that method is configurable, see below.

## Setup

- Create a workflow file in the root of your project under this path: `.github/workflows/your_file_name.yml`
- Declare the workflow! You can find the list of available inputs in the example below
   
  ```
  name: PR Use Cases Validation

  on:
     pull_request:
       types:
        # Configure these types yourself!
        - opened
        - edited
        - reopened
        - synchronize
  
     workflow_dispatch:
  
  jobs:
    pr_usecases_validation:
  
      runs-on: ubuntu-latest
  
      steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Validate PR Use Cases
        uses: nivisi/dart_pull_request_use_case_validator@0.0.2
        with:
           # GitHub Access Token
           # Required. Default is ${{ github.token }}
           github-token: ${{ github.token }}
  
           # Desired public callable method of a use case.
           # Required. Default is «run»
           method-name: run
  
           # The message that is printed in the approve review message.
           # Optional. Default is «The use cases for this pull requests were implemented correctly! Good job 👍»
           approve-message: Great job
  
           # Whether a use case file must contain only one class.
           # Required. Default is «true»
           single-class-in-file: true
  ```
- That's it! The action now will validate your code base on pull requests 🙂

## Note ❗️

The bot will request changes every time the workflow is triggered. E.g. if you push the code that contains problems, they will get reported. If after that you would push changes w/o fixing existing problems the bot will re-report the already reported problems.


<!-- References -->
[version-img]: https://img.shields.io/badge/action-v0.0.2-white
[version-url]: https://github.com/marketplace/actions/dart-pull-request-use-case-validator
