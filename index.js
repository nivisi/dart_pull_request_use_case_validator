'use strict';

const core = require("@actions/core");
const github = require("@actions/github");
const fs = require("fs");

const useCaseValidationOutputHeader = "🔎 Use Case Validator\n_Validating ..._";

const successfulOutput = "✅";
const unsuccessfulOutput = "❌";
const detailsIncorrectPublicMethod = "Incorrect public method";
const detailsNoUseCaseClass = "No valid use case class";
const detailsMultipleClasses = "Multiple classes in a single file";
const detailsAllValid = "All valid!";

function constructMustContainMethodMessage(methodName) {
    return "This class must contain only one public method called `" + methodName + "`";
}

function constructHasNoClassDeclarationMessage(
    expectedClassName,
    realClassName,
    classDeclaration,
    addSuggestion
) {
    var classDeclarationMessage = "This use case file does not contain a valid use case class.\n";

    if (addSuggestion) {
        classDeclarationMessage += "\n";
        classDeclarationMessage += "```suggestion\n";
        classDeclarationMessage += classDeclaration.replace(realClassName, expectedClassName);
        classDeclarationMessage += "\n```";
    } else {
        if (realClassName) {
            classDeclarationMessage += "It is `" + realClassName + "`, but should be `" + expectedClassName + "`.";
        } else {
            classDeclarationMessage += "It should be `" + expectedClassName + "`.";
        }
    }

    return classDeclarationMessage;
}

function processMethodDeclaration(
    filePath,
    rawContent,
    rawContentLines,
    methodName,
    reviewComments
) {
    console.log("\nPROCESSING METHOD DECLARATION\n");
    let methodDeclarationErrors = [];

    const regexStr = `([:space:]*) (.+) (${methodName})\()`;
    const methodDeclarationRegex = RegExp(regexStr, "g");
    const methodDeclaration = rawContent.match(methodDeclarationRegex);

    if (methodDeclaration) {
        console.log(`The ${methodName} method is correctly declared!`);
        return methodDeclarationErrors;
    }

    methodDeclarationErrors.push(detailsIncorrectPublicMethod);

    const otherMethodDeclarationRegex = /([:space:]*) (.+) (.+)\(/g;
    const otherMethodDeclarations = rawContent.match(otherMethodDeclarationRegex);

    if (!otherMethodDeclarations || otherMethodDeclarations.length == 0) {
        console.log(`The class does not contain the \`${methodName}\` method and any other public method`);

        const methodDeclarationMessage = constructMustContainMethodMessage(methodName);

        let comment = { path: filePath, line: 1, body: methodDeclarationMessage };
        reviewComments.push(comment);

        return methodDeclarationErrors;
    }

    console.log(`The class does not contain the ${methodName} method, but contains other public methods:\n${otherMethodDeclarations}`);

    let otherMethodDeclaration = otherMethodDeclarations[0];

    const methodDeclarationMessage = constructMustContainMethodMessage(methodName);

    function findMethodDeclaration(x) {
        return x.includes(otherMethodDeclaration);
    }

    let linePosition = rawContentLines.findIndex(findMethodDeclaration);

    let comment = { path: filePath, line: linePosition == -1 ? 1 : linePosition + 1, body: methodDeclarationMessage };
    reviewComments.push(comment);

    return methodDeclarationErrors;
}

function processClassDeclaration(
    fileName,
    filePath,
    rawContent,
    rawContentLines,
    reviewComments,
    isSingleClassInFile
) {
    console.log("\nPROCESSING CLASS DECLARATION\n");
    let classDeclarationErrors = [];

    const classDeclarationRegex = /(class) (.+) (.*){/g;

    const classDeclarations = rawContent.match(classDeclarationRegex);

    if (!classDeclarations || classDeclarations.length == 0) {
        console.log("There are no class declarations!");
        const classDeclarationMessage = "This file does not contain a use case class.";

        let comment = { path: filePath, line: 1, body: classDeclarationMessage };
        reviewComments.push(comment);

        classDeclarationErrors.push(detailsNoUseCaseClass);
    } else {
        if (isSingleClassInFile.toLowerCase() == "true") {
            if (classDeclarations.length > 1) {
                console.log("There is more than one class declaration");

                const classDeclarationMessage = "The `" + filePath + "` must not contain more than one class.";
                let comment = { path: filePath, line: 1, body: classDeclarationMessage };
                reviewComments.push(comment);

                classDeclarationErrors.push(detailsMultipleClasses);
            }
        }

        let fileNameParts = fileName.split("_");

        var expectedClassName = "";
        for (let index in fileNameParts) {
            let fileNamePart = fileNameParts[index];
            expectedClassName += fileNamePart.charAt(0).toUpperCase() + fileNamePart.slice(1);
        }
        expectedClassName += "UseCase";

        console.log(`Expected class name: «${expectedClassName}»`);

        var didFindUseCaseClass = false;

        var firstClassIndex = -1;
        var firstClassName = '';
        var firstClassDeclaration = '';

        var firstUseCaseClassIndex = -1;
        var firstUseCaseClassName = '';
        var firstUseCaseClassDeclaration = '';

        for (let index in classDeclarations) {
            let classDeclaration = classDeclarations[index];
            let className = classDeclaration.split(" ")[1];

            if (firstClassIndex == -1) {
                function findFileName(x) {
                    return x.includes(className);
                }

                firstClassIndex = rawContentLines.findIndex(findFileName);
                if (firstClassIndex != -1) {
                    firstClassName = className;
                    firstClassDeclaration = classDeclaration;
                }
            }

            if (!className.endsWith("UseCase")) {
                continue;
            }

            if (firstUseCaseClassIndex == -1) {
                function findFileName(x) {
                    return x.includes(className);
                }

                firstUseCaseClassIndex = rawContentLines.findIndex(findFileName);
                if (firstUseCaseClassIndex != -1) {
                    firstUseCaseClassName = className;
                    firstUseCaseClassDeclaration = classDeclaration;
                }
            }

            if (className != expectedClassName) {
                continue;
            }

            didFindUseCaseClass = true;
            break;
        }

        if (didFindUseCaseClass) {
            console.log(`The use case has the correct name «${expectedClassName}»`);
            // TODO: Find incorrect file name messages in the path and resolve them.
        } else {
            console.log(`The use case file does not contain a class named ${expectedClassName}.`);

            var classDeclarationMessage = "";
            var indexToUse = null;

            if (firstUseCaseClassIndex != -1) {
                indexToUse = firstUseCaseClassIndex;
                classDeclarationMessage += constructHasNoClassDeclarationMessage(
                    expectedClassName,
                    firstUseCaseClassName,
                    firstUseCaseClassDeclaration,
                    true,
                );
            } else if (firstClassIndex != -1) {
                indexToUse = firstClassIndex;
                classDeclarationMessage += constructHasNoClassDeclarationMessage(
                    expectedClassName,
                    firstClassName,
                    firstClassDeclaration,
                    true
                );
            } else {
                indexToUse = 0;
                classDeclarationMessage += constructHasNoClassDeclarationMessage(expectedClassName, null, null, false);
            }

            let comment = { path: filePath, line: indexToUse + 1, body: classDeclarationMessage };
            reviewComments.push(comment);

            classDeclarationErrors.push(detailsNoUseCaseClass);
        }
    }

    return classDeclarationErrors;
}

async function processFile(
    file,
    fileName,
    methodName,
    reviewComments,
    existingReviewComments,
    isSingleClassInFile
) {
    return new Promise((resolve, reject) => {
        const filePath = file.filename;

        console.log(`======= PROCESSING ${filePath} ========`);

        console.log("Reading the file ...");

        fs.readFile(filePath, 'utf8', (err, data) => {
            let errors = [];

            if (err) {
                core.setFailed(err);
            } else {
                let rawContent = data.toString();
                console.log("File content:\n\n```\n" + rawContent + "\n```\n");

                let rawContentLines = rawContent.split("\n");

                let classDeclarationErrors = processClassDeclaration(
                    fileName,
                    filePath,
                    rawContent,
                    rawContentLines,
                    reviewComments,
                    isSingleClassInFile
                );
                let methodDeclarationErrors = processMethodDeclaration(
                    filePath,
                    rawContent,
                    rawContentLines,
                    methodName,
                    reviewComments
                );

                errors.push(classDeclarationErrors);
                errors.push(methodDeclarationErrors);
            }

            resolve(errors);
        });
    });

}


async function run() {
    try {
        const methodName = core.getInput("method-name");
        const approveMessage = core.getInput("approve-message");
        const isSingleClassInFile = core.getInput("single-class-in-file");
        const githubToken = core.getInput("github-token");

        console.log("🔎 Dart Use Case validator!");
        console.log("");
        console.log("===== INPUTS =====");
        console.log(`methodName: ${methodName}`);
        console.log(`approveMessage: ${approveMessage}`);
        console.log(`isSingleClassInFile: ${isSingleClassInFile}`);
        console.log("\n\n");

        const context = github.context;

        const pullNumber = context.payload.pull_request.number;

        console.log("Getting GH access ...");
        const octokit = new github.getOctokit(githubToken);

        console.log("GH access received!");

        console.log("Getting pull request files ...");

        const files = await octokit.rest.pulls.listFiles({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pullNumber,
        });

        if (!files || files.length == 0) {
            console.log("No PR files found!");
            return;
        }

        const existingReviewComments = await octokit.rest.pulls.listReviewComments({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pullNumber,
        });

        const existingPrReviews = await octokit.rest.pulls.listReviews({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pullNumber,
        });

        let botPrReviews = existingPrReviews.data.filter(e => e.user.login == "github-actions[bot]");
        var validationOutputCommentId = null;

        if (!botPrReviews || botPrReviews.length == 0) {
            let result = await octokit.rest.pulls.createReview({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: pullNumber,
                event: "COMMENT",
                body: useCaseValidationOutputHeader
            });

            validationOutputCommentId = result.pull_request_review_id;
        } else {
            let validationOutputComment = botPrReviews.find(e => e.body.startsWith("🔎 Use Case Validator"));

            if (validationOutputComment) {
                validationOutputCommentId = validationOutputComment.pull_request_review_id;
            } else {
                let result = await octokit.rest.pulls.createReview({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: pullNumber,
                    event: "COMMENT",
                    body: useCaseValidationOutputHeader
                });

                validationOutputCommentId = result.pull_request_review_id;
            }
        }

        console.log("PR files received!\n\n");

        let reviewComments = [];

        var reviewTableRows = '';

        for (let index in files.data) {
            let file = files.data[index];
            let filePath = file.filename;

            if (!filePath.endsWith("_use_case.dart")) {
                continue;
            }

            let fileParts = filePath.split('/');
            let fileName = fileParts[fileParts.length - 1];

            let declarationErrors = await processFile(file, fileName, methodName, reviewComments, existingReviewComments, isSingleClassInFile);
            let areThereAnyErrors = declarationErrors && declarationErrors.length != 0;

            let rowFile = `\`${fileName}\`](${file.contents_url})`;
            let rowStatus = areThereAnyErrors ? unsuccessfulOutput : successfulOutput;;
            var rowDetails = '';

            if (areThereAnyErrors) {
                rowDetails = declarationErrors.map(e => `— ${e}`).join('<br/>');
            } else {
                rowDetails = detailsAllValid;
            }

            reviewTableRows += `| ${rowFile} | ${rowStatus} | ${rowDetails} |\n`;
        }

        if (reviewTableRows != '') {
            var reviewTable = '';
            reviewTable += '| File | Status | Details |';
            reviewTable += '| :--- | :----: | :------ |'
            reviewTable += reviewTableRows;

            await octokit.rest.pulls.updateReview({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: validationOutputCommentId,
                body: `${useCaseValidationOutputHeader}\n\n${reviewTable}`
            });
        }

        var latestPrReviewState;
        var latestBotPrReview;

        if (botPrReviews && botPrReviews.length && botPrReviews.length != 0) {
            latestBotPrReview = botPrReviews[botPrReviews.length - 1];

            if (latestBotPrReview) {
                console.log(latestBotPrReview);
                latestPrReviewState = latestBotPrReview.state.toLowerCase();
                console.log(`State of the latest PR Review: «${latestPrReviewState}»`);
            }
        }

        if (reviewComments.length == 0) {
            if (!latestPrReviewState || latestPrReviewState == "changes_requested") {
                await octokit.rest.pulls.createReview({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: pullNumber,
                    body: approveMessage,
                    event: "APPROVE",
                });
            }

            console.log("No Review Comments, considering a successful check ✅")
            return;
        }

        await octokit.rest.pulls.createReview({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pullNumber,
            event: "REQUEST_CHANGES",
            comments: reviewComments,
        });

        core.setFailed("Use case validator has found some issues.");
    } catch (error) {
        core.setFailed("ERROR OCCURED: " + error + "\n\nMessage: " + error.message);
    }
}

run()
