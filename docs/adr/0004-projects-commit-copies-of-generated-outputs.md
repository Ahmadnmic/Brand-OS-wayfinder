# Projects get committed copies of the Generated Outputs

A project needs a brand's CSS variables, Tailwind theme and font-face stylesheet
in its own code. It could import them from the Brand Package clone in the
plugin's data directory, or install the package as a dependency. We chose to
copy the Generated Outputs into the project at a path recorded in
`brand-os.json`, each file headed with the brand id, version and token hash,
committed and never hand-edited. The use-brand Skill writes and refreshes the
copies; Brand Check flags them when they are stale against `brand-os.json`.

Considered and rejected: importing from the plugin's data directory (the path is
per machine, so teammates, CI and deploys without Brand OS installed break);
installing the package as an npm or git dependency (every client project would
need access to the private package repo at build time, and non-JavaScript
stacks would need a second mechanism). The cost we accept: every client project
carries brand files that must be refreshed on each version bump, and a project
can drift from its package until Brand Check catches it.

Settled in
[The Skill set](https://github.com/Ahmadnmic/Brand-OS-wayfinder/issues/16).
