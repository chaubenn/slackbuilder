# Issues Board

A lightweight kanban for tracking work and managing Agile practises for SlackBuilder. 

Flow is someone fixes a ticket in Backlog -> Move ticket to QA -> Ping someone to QA -> QA person verifies then removes from QA to Done

## Backlog

### Improvement — improve model selector modal, clean up settings modal
- add tooltips to eye and brain icons to indicate to user what they mean (we know that the eye means its a vision-capable model, brain is that it has reasoning capabilities too)
- remove model and baseurl from settings 

### Implement - web search 
- allow users to take advantage of AI web-search

### QA - local AI models 
- users should be able to use local models, ones that are free to use and run locally 
- if they can't, allow them to do so

### Bug - editing inaccuracies 
- reproduce bug: 'i found a bug where the jwt keys arent expireing, state why its possibly occuring and propose solutions' then 'input just at the bottom of the message the current price of bitcoin'
- expected: price of bitcoin is at the bottom, however right now changes are always going to the top (whenever I say, add to bottom, it almost always doesnt add it to the bottom)

### Improvement - cancelling prompts
- right now, when you run a prompt, and cancel it, the response is (cancelled), instead, make it so that the user's prompt goes back into the promptbox, and they are able to edit the prompt to rerun again 


## QA 

## Done 