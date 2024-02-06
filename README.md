# Recruitment Splicer

## Purpose

This script is used as a 'Trigger' service that sorts the responses an applicant makes to Monash DeepNeuron's recruitment (Google) Form. The service runs when the applicant submits the form.

## How to use

You can simply copy the main scripts (`recruitment_submission_trigger.js`) contents into your own forms AppScript project as it's own `*.gs` file. You will also need the `appsscript.json` file to allow the proper OAuth rights. You can then add the script as a 'Trigger' for the forms on-submit request. Documentation can be found here:

- [INstallable Triggers](https://developers.google.com/apps-script/guides/triggers/installable)
- [on-submit 'installable' trigger](https://developers.google.com/apps-script/guides/triggers/events#google_forms_events:~:text=to%20modify%20it.-,Form%20submit,-(installable))

## Contributing and Labelling

If you are updating this script to meet new requirements for the recruitment process, ensure to use a Git tag to mark which year and semester the new version is being used for to help in archival purposes.

## License

This script is licensed under [Apache-2.0](LICENSE).
