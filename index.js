#!/usr/bin/env node

const clubhouse = require('commander')
const fetch = require('node-fetch')
const { version } = require('./package.json')

async function getStories (days) {
  console.log('your looking for stories from ' + days + ' ago.')
  const token = process.env.CLUBHOUSE_API_TOKEN
  if (!token) return console.log('CLUBHOUSE_API_TOKEN environment variable is not set')
  const url = 'https://api.clubhouse.io/api/v2/'

  let query = `teams?token=${token}`

  console.log('fetching teams...')
  const teams = await fetch(url + query).then(res => res.json())
  query = `search/stories?token=${token}&query=completed:2018-12-09..2018-12-16&page_size=25`

  console.log('fetching stories...')
  // THIS ONLY CONTAINS 25 stories, need access to all of the stories
  const stories = await fetch(url + query).then(res => res.json())
  for (let i = 0; i < teams.length; i++) {
    const teamStories = stories.data.filter(story => {
      return teams[i].project_ids.includes(story.project_id)
    })
    console.log(teams[i].name, teamStories.map(story => story.id))
  }
}

clubhouse
  .version(version)

clubhouse
  .command('stories <days>')
  .description('get story values for a specified number of days')
  .action(getStories)

clubhouse
  .command('*')
  .description('show help menu if command does not exist')
  .action(() => {
    clubhouse.help()
  })

clubhouse.parse(process.argv)

if (!clubhouse.args.length) {
  clubhouse.help()
}
