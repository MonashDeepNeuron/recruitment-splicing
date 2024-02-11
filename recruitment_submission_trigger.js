// Copyright (c) Tyler Swann and Monash DeepNeuron 2024

class BranchMetadata {
    /** Constructs Span with name and given range.
     *
     * @param {string} sheet_name - Name of branch
     * @param {Number} span_start - Start index of Span
     * @param {Number} span_end - Last index of Span
     * @param {Number} analytics_cidx - The (column) index
     *                                  of the 'ID Map &
     *                                  Analytics' sheet
     *                                  that needs to be
     *                                  marked
     */
    constructor(
        sheet_name = "Default",
        span_start = 0,
        span_end = 0,
        analytics_cidx = undefined
    ) {
        this.name = sheet_name;
        this.start = span_start;
        this.end = span_end;
        this.analytics_cidx = analytics_cidx;
    }
}

const metadata = {
    "Common": new BranchMetadata("Common", 6, 25),
    "AI": new BranchMetadata("AI", 32, 39, 4),
    "HPC": new BranchMetadata("HPC", 40, 47, 5),
    "Marketing, Design and Publications": new BranchMetadata(
        "Marketing",
        48,
        55,
        6
    ),
    "Industry Team": new BranchMetadata("Industry", 56, 58, 7),
    "Events Team": new BranchMetadata("Events", 63, 68, 8),
    "People and Culture Officer": new BranchMetadata("P&C", 69, 73, 9),
    "Law & Ethics Committee": new BranchMetadata("L&E", 26, 31, 10),
    "Outreach Team": new BranchMetadata("Outreach", 59, 62, 11),
    "Training Team": new BranchMetadata("Training", 74, 79, 12),
    "Branch Switch Indexes": [25, 31, 39, 47, 55, 58, 62, 68, 73, 79],
    "Unique Count Cell": "A4",
};

/** Transforms sheet cell data to appropriate format for
 * processing. This mostly involves transforming
 * Array data back into a comma separated string.
 *
 * @param {Object} data - Data from cell to transform
 * @returns {Object}
 */
function transform_response(data) {
    if (Array.isArray(data)) {
        return data.join(", ");
    }

    return data;
}

/** Computes ID hash from input string.
 * Uses the MD5 hash algorithm.
 *
 * @param {string} input_str
 * @returns {string}
 */
function id_hash(input_str) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input_str)
        .map((char) => "0" + ((char + 256) % 256).toString(16).slice(-2)) // Turn 8-bit (signed) numbers to char
        .join("");
}

/** Updates sheet with applicants general details
 * and responses to branch specific questions.
 *
 * @param {string} id - Anonymous ID of applicant
 * @param {Array<Array<Object>>} responses - Array of branch specific and generic responses to form
 * @param {Sheet} sheet - Sheet to edit
 */
function add_or_update_entry(id, responses, sheet) {
    const num_rows = sheet.getLastRow();
    const new_entry_row = num_rows + 1;

    const id_column = sheet
        .getRange(2, 1, num_rows, 1)
        .getValues()
        .flatMap((row) => row);

    const existing_entry_idx = id_column.indexOf(id);
    if (existing_entry_idx > -1) {
        // +2 for offsetting from the 1-based indexing of G-Sheets
        // and the fact we are going from the second row down due
        // to the first having the questions.
        sheet
            .getRange(existing_entry_idx + 2, 2, 1, responses[0].length)
            .setValues(responses);
        return;
    }

    sheet
        .getRange(new_entry_row, 2, 1, responses[0].length)
        .setValues(responses);

    sheet.getRange(new_entry_row, 1).setValue(id);
}

/** Adds or updates the 'ID Map & Analytics' sheet with info from
 * applicants responses.
 *
 * @param {string} id - Anonymous ID of applicant
 * @param {boolean} applied - Value to update in branch column for applicant
 * @param {Number} analytics_cidx - Column to update
 * @param {Sheet} analytics_sheet - The sheet to add the analytical
 *                                  data to
 */
function update_analytics(id, name, email, analytics_cidx, analytics_sheet) {
    const num_rows = analytics_sheet.getLastRow();
    const new_entry_row = num_rows + 1;

    const id_column = analytics_sheet
        .getRange(2, 1, num_rows, 1)
        .getValues()
        .flatMap((row) => row);

    const existing_entry_idx = id_column.indexOf(id);
    if (existing_entry_idx > -1) {
        // +2 for offsetting from the 1-based indexing of G-Sheets
        // and the fact we are going from the second row down due
        // to the first having the questions.
        analytics_sheet
            .getRange(existing_entry_idx + 2, analytics_cidx, 1, 1)
            .setValue("TRUE");
        return;
    }

    // update total unique count
    const unique_count_cell = analytics_sheet.getRange(
        metadata["Unique Count Cell"]
    );

    const current = unique_count_cell.getValue();
    unique_count_cell.setValue(current + 1);

    // Initialise new row with 'FALSE'
    analytics_sheet
        .getRange(new_entry_row, 2, 1, 11)
        .setValues([
            [
                name,
                email,
                "FALSE",
                "FALSE",
                "FALSE",
                "FALSE",
                "FALSE",
                "FALSE",
                "FALSE",
                "FALSE",
                "FALSE",
            ],
        ]);

    analytics_sheet
        .getRange(new_entry_row, analytics_cidx, 1, 1)
        .setValue("TRUE");

    analytics_sheet.getRange(new_entry_row, 1).setValue(id);
}

/** Determines which branches have applications
 * and forwards responses to each branch
 * anonymised by ID hash.
 *
 * @param {string} id - Anonymous ID hash
 * @param {Array<Object>} responses - Array of responses
 * @param {Spreadsheet} workbook - The active workbook
 */
function splice_across_branches(id, responses, workbook) {
    console.log("Splice");

    const common_metadata = metadata["Common"];
    const common_responses = responses.slice(
        common_metadata.start,
        common_metadata.end
    );

    // Construct lock to prevent data race on responses splicing
    const script_lock = LockService.getScriptLock();

    console.log(`Before Lock: ${id}`);

    // Attempt to gain the this scripts lock, log timeout/wait time.
    let total_wait_time = 0;
    while (!script_lock.tryLock(20000)) {
        total_wait_time += 20000;
        console.log(
            `Service to ${id} could not obtain lock after 20s (Total wait: ${total_wait_time})`
        );
    }

    console.log(`Servicing now ${id}`);

    console.log(metadata["Branch Switch Indexes"].map((idx) => responses[idx]));

    // Looping through response fields marking which branches
    // applicant is applying to
    for (const idx of metadata["Branch Switch Indexes"]) {
        const branch = responses[idx];
        console.log("branch: ", branch);

        if (branch !== "" && branch !== "No") {
            const branch_span = metadata[branch];

            const branch_responses = responses.slice(
                branch_span.start,
                branch_span.end
            );

            const combined_responses = [
                common_responses.concat(branch_responses),
            ];

            // Append
            add_or_update_entry(
                id,
                combined_responses,
                workbook.getSheetByName(branch_span.name)
            );

            // Update analytics for branch
            update_analytics(
                id,
                responses[2].slice(0) + " " + responses[3].slice(0), // have to slice others array entries stringify to "[object Object]"
                responses[1],
                metadata[branch].analytics_cidx,
                workbook.getSheetByName("ID Map & Analytics")
            );
        }

        SpreadsheetApp.flush();
    }

    script_lock.releaseLock();

    console.log(`Finished service to ${id}`);
}

/** Entry point of Form submission trigger
 *
 * @param {Event} e - The Event object for form submission.
 */
function recruitment_application_submit_trigger(e) {
    // Form object
    const form = e.source;

    // Destination/responses spreadsheet and ID
    const workbook_id = form.getDestinationId();
    const workbook = SpreadsheetApp.openById(workbook_id);

    // Responses sheet
    const response_sheet = workbook.getSheetByName("Form responses 1");

    /**
     * Last row with data in response sheet.
     * Has to come from sheet directly and not
     * the FormResponse object from `e` as
     * the later only has the responses and not
     * the empty cells needed to copy the full
     * range in `dup_with_id()`.
     */
    const latest_row = response_sheet.getLastRow();

    // Response that fired the trigger
    const responses = response_sheet
        .getRange(`A${latest_row}:CB${latest_row}`)
        .getValues()[0]
        .map(transform_response);

    // Anonymising ID used for application marking.
    const id = id_hash(responses[1] + responses[4]);

    splice_across_branches(id, responses, workbook);
}
