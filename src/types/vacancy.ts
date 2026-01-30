export type Vacancy = {
  id: string
  title: string
  shortDescription: string
  requirements: {
    skills: string[]
    experienceLevel: 'junior' | 'middle' | 'senior'
    yearsMin: number
  }
}