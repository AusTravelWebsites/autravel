import { permanentRedirect } from 'next/navigation'

export default function BlogIndex() {
  // The blog index lives at /articles/ — send the legacy /blog/ URL there
  // rather than the homepage so visitors land on the actual article listing.
  permanentRedirect('/articles/')
}
