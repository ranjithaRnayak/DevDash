export const getMockAIResponse = (input) => {
    input = input.toLowerCase();

    if (input.includes("pipeline") && input.includes("failed")) {
        return "🔧 The pipeline failed due to a missing dependency. Consider running `npm install` or checking your project references.";
    }

    if (input.includes("build") && input.includes("error")) {
        return "⚠️ Your build error seems related to a missing script. Check `package.json` for a `build` script definition.";
    }

    if (input.includes("code") && input.includes("issue")) {
        return "🧹 Code analysis found critical issues. Please review your static code analyzer report.";
    }

    return "🤖 I'm not sure what you mean yet, but I'm learning fast! Try asking about a build or pipeline error.";
};