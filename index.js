'use strict';

const core = require("@actions/core");
const github = require("@actions/github");
const fs = require("fs");

function constructMustContainMethodMessage(methodName) {
    return "This class must contain only one public method called `" + methodName + "`";
}

function constructHasNoClassDeclarationMessage(expectedClassName, realClassName, classDeclaration, addSuggestion) {
    var classDeclarationMessage = "The use case has the wrong name, based on the file name.\n";

    if (addSuggestion) {
        classDeclarationMessage += "\n";
        classDeclarationMessage += "```suggestion\n";
        classDeclarationMessage += classDeclaration.replace(realClassName, expectedClassName);
        classDeclarationMessage += "\n```";
    } else {
        classDeclarationMessage += "It is `" + realClassName + "`, but should be `" + expectedClassName + "`.";
    }

    return classDeclarationMessage;
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

function processMethodDeclaration(
    fileName,
    rawContent,
    rawContentLines,
    methodName,
    reviewComments
) {
    console.log("\nPROCESSING METHOD DECLARATION\n");

    const regexStr = `([:space:]*) (.+) (${methodName})\()`;
    const methodDeclarationRegex = RegExp(regexStr, "g");
    const methodDeclaration = rawContent.match(methodDeclarationRegex);

    if (methodDeclaration) {
        console.log(`The ${methodName} method is correctly declared!`);
        return;
    }

    const otherMethodDeclarationRegex = /([:space:]*) (.+) (.+)\(/g;
    const otherMethodDeclarations = rawContent.match(otherMethodDeclarationRegex);

    if (!otherMethodDeclarations || otherMethodDeclarations.length == 0) {
        console.log(`The class does not contain the ${methodName} method and any other public method`);

        const methodDeclarationMessage = constructMustContainMethodMessage(methodName);

        let comment = { path: fileName, line: 1, body: methodDeclarationMessage };
        reviewComments.push(comment);

        return;
    }

    console.log(`The class does not contain the ${methodName} method, but contains other public methods:\n${otherMethodDeclarations}`);

    let otherMethodDeclaration = otherMethodDeclarations[0];

    const methodDeclarationMessage = constructMustContainMethodMessage(methodName);

    function findMethodDeclaration(x) {
        return x.includes(otherMethodDeclaration);
    }

    let linePosition = rawContentLines.findIndex(findMethodDeclaration);

    let comment = { path: fileName, line: linePosition == -1 ? 1 : linePosition + 1, body: methodDeclarationMessage };
    reviewComments.push(comment);
}

function processClassDeclaration(
    filePath,
    rawContent,
    rawContentLines,
    reviewComments,
    existingReviewComments
) {
    console.log("\nPROCESSING CLASS DECLARATION\n");

    const classDeclarationRegex = /(class) (.+) (.*){/g;

    const classDeclarations = rawContent.match(classDeclarationRegex);

    if (!classDeclarations) {
        console.log("There is no class declaration!");
        const classDeclarationMessage = "This file does not contain a use case class.";

        let comment = { path: filePath, line: 1, body: classDeclarationMessage };
        reviewComments.push(comment);
    } else {
        if (classDeclarations.length > 1) {
            console.log("There is more than one class declaration");

            const classDeclarationMessage = `The ${filePath} must not contain more than one class.`;
            let comment = { path: filePath, line: 1, body: classDeclarationMessage };
            reviewComments.push(comment);
        } else {
            let first = classDeclarations[0];
            let className = first.split(" ")[1];
            let fileParts = filePath.split("/");

            console.log(`There is only one class declaration, «${first}»`);

            let fileName = fileParts[fileParts.length - 1].replace("_use_case.dart", "");
            let fileNameParts = fileName.split("_");

            var expectedClassName = "";
            for (let index in fileNameParts) {
                let fileNamePart = fileNameParts[index];
                expectedClassName += fileNamePart.charAt(0).toUpperCase() + fileNamePart.slice(1);
            }
            expectedClassName += "UseCase";

            console.log(`Expected class name: «${expectedClassName}»`);

            function findFileName(x) {
                return x.includes(first);
            }

            if (className != expectedClassName) {
                console.log(`The use case has the incorrect name, ${className}. But it should be ${expectedClassName}`);

                let linePosition = rawContentLines.findIndex(findFileName);
                var classDeclarationMessage = "";

                if (linePosition == -1) {
                    classDeclarationMessage += constructHasNoClassDeclarationMessage(expectedClassName, className, first, false);
                } else {
                    classDeclarationMessage += constructHasNoClassDeclarationMessage(expectedClassName, className, first, true);
                }

                let comment = { path: filePath, line: linePosition == -1 ? 1 : linePosition + 1, body: classDeclarationMessage };
                reviewComments.push(comment);
            } else {
                // TODO: Find incorrect file name messages in the path and resolve them.
                console.log("The use case has the correct name, " + expectedClassName);
            }
        }
    }
}

async function processFile(
    file,
    methodName,
    reviewComments,
    existingReviewComments
) {
    return new Promise((resolve, reject) => {
        let fileName = file.filename;

        if (!fileName.endsWith("_use_case.dart")) {
            resolve();
            return;
        }

        console.log(`======= PROCESSING ${fileName} ========`);

        console.log("Reading the file ...");

        fs.readFile(fileName, 'utf8', (err, data) => {
            if (err) {
                core.setFailed(err);
            } else {
                let rawContent = data.toString();
                console.log("File content:\n\n```\n" + rawContent + "\n```\n");

                let rawContentLines = rawContent.split("\n");

                processClassDeclaration(fileName, rawContent, rawContentLines, reviewComments, existingReviewComments);
                processMethodDeclaration(fileName, rawContent, rawContentLines, methodName, reviewComments);
            }

            resolve();
        });
    });

}


async function run() {
    try {
        const methodName = core.getInput("method-name");
        const approveMessage = core.getInput("approve-message");
        const githubToken = core.getInput("github-token");

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

        console.log("PR files received!");

        let reviewComments = [];

        for (let index in files.data) {
            let file = files.data[index];

            await processFile(file, methodName, reviewComments, existingReviewComments);
        }

        var latestPrReviewState;

        let botPrReviews = existingPrReviews.data.filter(e => e.user.login == "github-actions[bot]");
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
